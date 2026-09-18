import { Request, Response, NextFunction } from 'express';
import { OrganizationModel } from '../../models/Organization.model';
import { CustomFieldModel } from '../../models/CustomField.model';
import { BILLING_MODEL_PRESETS } from '../../billing-engine/billing-models/presets';
import { logAuditEvent } from '../../core/audit/audit.service';

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

export async function updateOrganizationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, settings, enabledModules, isOnboarded } = req.body;
    const orgId = req.tenant!.organizationId;

    const updatedOrg = await OrganizationModel.findByIdAndUpdate(
      orgId,
      {
        ...(name && { name }),
        ...(settings && { settings }),
        ...(enabledModules && { enabledModules }),
        ...(isOnboarded !== undefined && { isOnboarded }),
      },
      { new: true }
    );

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'UPDATE_ORGANIZATION_SETTINGS',
      entityType: 'Organization',
      entityId: orgId,
      details: { name, settings, isOnboarded },
    });

    res.json({ success: true, data: updatedOrg });
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

    // Auto-inject suggested fields if not existing
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

    // 1. Update organization model & modules
    if (architecture.baseBillingModel) {
      org.billingModel = architecture.baseBillingModel;
    }
    if (architecture.recommendedModules && Array.isArray(architecture.recommendedModules)) {
      org.enabledModules = Array.from(new Set([...org.enabledModules, ...architecture.recommendedModules]));
    }
    if (architecture.suggestedTaxSystem) {
      org.settings.taxSystem = architecture.suggestedTaxSystem;
    }
    org.isOnboarded = true;
    await org.save();

    // 2. Provision Custom Fields
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

    // 3. Provision Business Rules
    if (architecture.businessRules && Array.isArray(architecture.businessRules)) {
      const { BusinessRuleModel } = await import('../../models/BusinessRule.model');
      for (const rule of architecture.businessRules) {
        if (!rule.ruleName) continue;
        const existing = await BusinessRuleModel.findOne({
          organizationId: orgId,
          ruleName: rule.ruleName,
        });
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
