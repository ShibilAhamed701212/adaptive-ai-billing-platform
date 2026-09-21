import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { OrganizationModel } from '../../models/Organization.model';
import { MembershipModel } from '../../models/Membership.model';
import { UserModel } from '../../models/User.model';
import { CustomFieldModel } from '../../models/CustomField.model';
import { BILLING_MODEL_PRESETS } from '../../billing-engine/billing-models/presets';
import { logAuditEvent } from '../../core/audit/audit.service';
import { makeUniqueOrgSlug } from '../../core/utils/slug';
import { ENV } from '../../config/env';
import {
  modulesForBusinessType,
  ALL_MODULES,
  BUSINESS_TYPE_BILLING_MODEL,
  type BusinessType,
} from '@billing/shared';
import { setSessionCookie } from '../../core/security/session-cookie';

const VALID_BUSINESS_TYPES: BusinessType[] = ['retail', 'saas', 'services', 'general'];
const VALID_BILLING_MODELS = ['retail', 'subscription', 'usage_based', 'rental', 'professional_services', 'healthcare', 'logistics', 'custom'];
const VALID_MODULES = new Set<string>(ALL_MODULES);

function sanitizeModules(modules: unknown): string[] {
  return Array.isArray(modules)
    ? Array.from(new Set(modules.filter((moduleId): moduleId is string => typeof moduleId === 'string' && VALID_MODULES.has(moduleId))))
    : [];
}

function serializeOrg(org: any) {
  if (!org) return null;
  return {
    _id: org._id,
    name: org.name,
    slug: org.slug,
    billingModel: org.billingModel,
    businessType: org.businessType,
    enabledModules: org.enabledModules,
    settings: org.settings,
    isOnboarded: org.isOnboarded,
    onboarding: org.onboarding,
  };
}

async function loadMemberships(userId: string) {
  const memberships = await MembershipModel.find({
    userId: new mongoose.Types.ObjectId(userId),
    status: { $ne: 'disabled' },
  }).populate('organizationId');

  return memberships.map((m: any) => ({
    _id: m._id,
    userId: m.userId,
    organizationId: m.organizationId?._id || m.organizationId,
    organization: serializeOrg(m.organizationId),
    role: m.role,
    status: m.status,
  }));
}

export async function getOrganizationProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const org = await OrganizationModel.findById(req.tenant!.organizationId);
    if (!org) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } });
      return;
    }
    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
}

export async function listMyOrganizations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const memberships = await loadMemberships(req.tenant!.userId);
    res.json({ success: true, data: memberships });
  } catch (err) {
    next(err);
  }
}

export async function createOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.tenant!.userId;
    const { name, businessType = 'general', billingModel, settings, enabledModules } = req.body;

    if (!name || String(name).trim().length < 2) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Organization name is required' } });
      return;
    }

    const bt: BusinessType = VALID_BUSINESS_TYPES.includes(businessType) ? businessType : 'general';
    if (billingModel && !VALID_BILLING_MODELS.includes(billingModel)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown billing model' } });
      return;
    }
    const model = billingModel || BUSINESS_TYPE_BILLING_MODEL[bt];
    const modules =
      Array.isArray(enabledModules) && enabledModules.length > 0
        ? sanitizeModules(enabledModules)
        : modulesForBusinessType(bt);

    const organization = await OrganizationModel.create({
      name: String(name).trim(),
      slug: await makeUniqueOrgSlug(String(name)),
      billingModel: model,
      businessType: bt,
      enabledModules: modules,
      settings: settings || {},
      isOnboarded: false,
      onboarding: { currentStep: 1, completedSteps: [], skipped: false },
    });

    const preset = BILLING_MODEL_PRESETS[model];
    if (preset?.suggestedCustomFields) {
      for (const field of preset.suggestedCustomFields) {
        await CustomFieldModel.create({ organizationId: organization._id, ...field });
      }
    }

    const membership = await MembershipModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: organization._id,
      role: 'admin',
      status: 'active',
    });

    // Switch the creator into their new organization.
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    user.organizationId = organization._id;
    await user.save();

    await logAuditEvent({
      organizationId: String(organization._id),
      userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_ORGANIZATION',
      entityType: 'Organization',
      entityId: String(organization._id),
      details: { name: organization.name, businessType: bt },
    });

    const token = jwt.sign(
      { organizationId: String(organization._id), userId: String(user._id), role: 'admin', email: user.email },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const memberships = await loadMemberships(userId);

    setSessionCookie(res, token);
    res.status(201).json({
      success: true,
      data: {
        user: { _id: user._id, name: user.name, email: user.email, role: 'admin', organizationId: user.organizationId },
        organization: serializeOrg(organization),
        memberships,
        membershipId: membership._id,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function switchOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.tenant!.userId;
    const { organizationId } = req.body;

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A valid organizationId is required' } });
      return;
    }

    const membership = await MembershipModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      status: 'active',
    });

    // The backend — not the client — verifies membership before switching.
    if (!membership) {
      res.status(403).json({
        success: false,
        error: { code: 'NOT_A_MEMBER', message: 'You do not have access to this organization' },
      });
      return;
    }

    const organization = await OrganizationModel.findById(organizationId);
    const user = await UserModel.findById(userId);
    if (!organization || !user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization or user not found' } });
      return;
    }

    user.organizationId = organization._id;
    await user.save();

    const token = jwt.sign(
      { organizationId: String(organization._id), userId: String(user._id), role: membership.role, email: user.email },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAuditEvent({
      organizationId: String(organization._id),
      userId,
      userEmail: req.tenant!.email,
      action: 'SWITCH_ORGANIZATION',
      entityType: 'Organization',
      entityId: String(organization._id),
      details: { role: membership.role },
    });

    const memberships = await loadMemberships(userId);

    setSessionCookie(res, token);
    res.json({
      success: true,
      data: {
        user: { _id: user._id, name: user.name, email: user.email, role: membership.role, organizationId: user.organizationId },
        organization: serializeOrg(organization),
        memberships,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOrganizationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, settings, enabledModules, isOnboarded, onboarding, businessType } = req.body;
    const orgId = req.tenant!.organizationId;

    const org = await OrganizationModel.findById(orgId);
    if (!org) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } });
      return;
    }

    if (name) org.name = String(name).trim();
    if (businessType && VALID_BUSINESS_TYPES.includes(businessType)) org.businessType = businessType;
    if (Array.isArray(enabledModules)) {
      // Validate modules against a known list (Phase 11 & 12 Requirement)
      const sanitizedModules = sanitizeModules(enabledModules);

      const addedModules = sanitizedModules.filter((m: string) => !org.enabledModules.includes(m));
      org.enabledModules = sanitizedModules;
      if (addedModules.length > 0) {
        org.moduleAudit = org.moduleAudit || [];
        addedModules.forEach((moduleId: string) => {
          let enabledBy = 'admin';
          if (req.body._enabledBySystem) enabledBy = 'system';
          else if (req.body._enabledByAi) enabledBy = 'ai';
          
          org.moduleAudit!.push({
            moduleId,
            enabledBy: enabledBy as any,
            timestamp: new Date().toISOString(),
          });
        });
      }
    }
    if (isOnboarded !== undefined) org.isOnboarded = Boolean(isOnboarded);
    if (onboarding && typeof onboarding === 'object') {
      (org as any).onboarding = {
        ...(org as any).onboarding,
        ...onboarding,
      };
    }
    if (settings && typeof settings === 'object') {
      // Deep-merge so partial profile updates never wipe existing settings.
      org.settings = {
        ...org.settings,
        ...settings,
        address: { ...(org.settings as any).address, ...(settings.address || {}) },
      } as any;
    }

    await org.save();

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'UPDATE_ORGANIZATION_SETTINGS',
      entityType: 'Organization',
      entityId: orgId,
      details: { name, isOnboarded },
    });

    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
}

export async function switchBillingModel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { billingModel } = req.body;
    const orgId = req.tenant!.organizationId;

    const preset = BILLING_MODEL_PRESETS[billingModel];
    if (!preset) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_MODEL', message: 'Unknown billing model' },
      });
      return;
    }

    const org = await OrganizationModel.findById(orgId);
    if (!org) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } });
      return;
    }

    org.billingModel = billingModel;
    if (preset.defaultTaxSystem) {
      org.settings.taxSystem = preset.defaultTaxSystem;
    }
    if (preset.defaultModules) {
      org.enabledModules = Array.from(new Set([...org.enabledModules, ...preset.defaultModules]));
    }
    await org.save();

    if (preset.suggestedCustomFields) {
      for (const field of preset.suggestedCustomFields) {
        const existing = await CustomFieldModel.findOne({
          organizationId: orgId,
          targetEntity: field.targetEntity,
          fieldName: field.fieldName,
        });
        if (!existing) {
          await CustomFieldModel.create({
            organizationId: orgId,
            ...field,
          });
        }
      }
    }

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'SWITCH_BILLING_MODEL',
      entityType: 'Organization',
      entityId: orgId,
      details: { newModel: billingModel },
    });

    res.json({
      success: true,
      data: org,
      message: `Successfully configured organization for '${preset.name}'`,
    });
  } catch (err) {
    next(err);
  }
}

export async function applyCustomArchitecture(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { architecture } = req.body;
    const orgId = req.tenant!.organizationId;

    if (!architecture) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ARCHITECTURE', message: 'Architecture payload is required' } });
      return;
    }

    const org = await OrganizationModel.findById(orgId);
    if (!org) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } });
      return;
    }

    if (architecture.baseBillingModel) {
      org.billingModel = architecture.baseBillingModel;
    }
    if (architecture.recommendedModules && Array.isArray(architecture.recommendedModules)) {
      const sanitizedModules = sanitizeModules(architecture.recommendedModules);
      const addedModules = sanitizedModules.filter((m: string) => !org.enabledModules.includes(m));
      
      org.enabledModules = Array.from(new Set([...org.enabledModules, ...sanitizedModules]));
      
      if (addedModules.length > 0) {
        org.moduleAudit = org.moduleAudit || [];
        addedModules.forEach((moduleId: string) => {
          org.moduleAudit!.push({
            moduleId,
            enabledBy: req.body._enabledBySystem ? 'system' : 'ai',
            timestamp: new Date().toISOString(),
          });
        });
      }
    }
    if (architecture.suggestedTaxSystem) {
      org.settings.taxSystem = architecture.suggestedTaxSystem;
    }
    org.isOnboarded = true;
    await org.save();

    if (architecture.customFields && Array.isArray(architecture.customFields)) {
      for (const field of architecture.customFields) {
        if (!field.fieldName || !field.targetEntity) continue;
        const existing = await CustomFieldModel.findOne({
          organizationId: orgId,
          targetEntity: field.targetEntity,
          fieldName: field.fieldName,
        });
        if (!existing) {
          await CustomFieldModel.create({
            organizationId: orgId,
            targetEntity: field.targetEntity,
            fieldName: field.fieldName,
            label: field.label || field.fieldName,
            fieldType: field.fieldType || 'text',
            required: !!field.required,
            options: field.options || [],
            placeholder: field.placeholder || '',
            order: 1,
          });
        }
      }
    }

    if (architecture.businessRules && Array.isArray(architecture.businessRules)) {
      const { BusinessRuleModel } = await import('../../models/BusinessRule.model');
      for (const rule of architecture.businessRules) {
        if (!rule.ruleName) continue;
        const existing = await BusinessRuleModel.findOne({ organizationId: orgId, ruleName: rule.ruleName });
        if (!existing) {
          await BusinessRuleModel.create({
            organizationId: orgId,
            ruleName: rule.ruleName,
            description: rule.description || 'AI Auto-Configured Business Rule',
            event: rule.event || 'beforeInvoiceCalculate',
            condition: rule.condition || { field: 'invoiceSubtotal', operator: 'greater_than', value: 100000 },
            action: rule.action || { type: 'apply_discount', value: 5, message: 'High Value Discount' },
            isActive: true,
          });
        }
      }
    }

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'APPLY_AI_ARCHITECTURE',
      entityType: 'Organization',
      entityId: orgId,
      details: {
        modelName: architecture.modelName,
        customFieldsCount: architecture.customFields?.length || 0,
        rulesCount: architecture.businessRules?.length || 0,
      },
    });

    res.json({
      success: true,
      data: org,
      message: `Successfully provisioned custom billing architecture: '${architecture.modelName}'`,
    });
  } catch (err) {
    next(err);
  }
}
