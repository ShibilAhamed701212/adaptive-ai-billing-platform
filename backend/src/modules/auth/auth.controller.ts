import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../../models/User.model';
import { OrganizationModel } from '../../models/Organization.model';
import { MembershipModel } from '../../models/Membership.model';
import { CustomFieldModel } from '../../models/CustomField.model';
import { BILLING_MODEL_PRESETS } from '../../billing-engine/billing-models/presets';
import { ENV } from '../../config/env';
import { logAuditEvent } from '../../core/audit/audit.service';
import {
  modulesForBusinessType,
  BUSINESS_TYPE_BILLING_MODEL,
  type BusinessType,
} from '@billing/shared';
import mongoose from 'mongoose';
import { setSessionCookie, clearSessionCookie } from '../../core/security/session-cookie';

function inferBusinessType(billingModel?: string): BusinessType {
  switch (billingModel) {
    case 'retail':
      return 'retail';
    case 'subscription':
    case 'usage_based':
      return 'saas';
    case 'rental':
    case 'logistics':
    case 'professional_services':
    case 'healthcare':
      return 'services';
    default:
      return 'general';
  }
}

import { makeUniqueOrgSlug } from '../../core/utils/slug';

/**
 * Guarantees a membership exists for the user's home organization.
 * This lazily backfills legacy users created before memberships existed.
 */
async function ensureMembership(user: any): Promise<void> {
  if (!user?.organizationId) return;
  const existing = await MembershipModel.findOne({
    userId: user._id,
    organizationId: user.organizationId,
  });
  if (!existing) {
    await MembershipModel.create({
      userId: user._id,
      organizationId: user.organizationId,
      role: user.role || 'viewer',
      status: user.isActive === false ? 'disabled' : 'active',
    });
  }
}

async function buildSessionPayload(user: any, activeOrgId: string) {
  const [organization, memberships] = await Promise.all([
    OrganizationModel.findById(activeOrgId),
    MembershipModel.find({ userId: user._id, status: { $ne: 'disabled' } }).populate('organizationId'),
  ]);

  if (!organization) return null;

  const activeMembership = memberships.find(
    (m: any) => String(m.organizationId?._id || m.organizationId) === String(activeOrgId)
  );
  const role = activeMembership?.role || user.role;

  const token = jwt.sign(
    {
      organizationId: String(organization._id),
      userId: String(user._id),
      role,
      email: user.email,
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role,
      organizationId: user.organizationId,
    },
    organization: {
      _id: organization._id,
      name: organization.name,
      slug: organization.slug,
      billingModel: organization.billingModel,
      businessType: (organization as any).businessType,
      enabledModules: organization.enabledModules,
      settings: organization.settings,
      isOnboarded: organization.isOnboarded,
      onboarding: (organization as any).onboarding,
    },
    memberships: memberships.map((m: any) => ({
      _id: m._id,
      userId: m.userId,
      organizationId: m.organizationId?._id || m.organizationId,
      organization: m.organizationId?._id
        ? {
            _id: m.organizationId._id,
            name: m.organizationId.name,
            slug: m.organizationId.slug,
            billingModel: m.organizationId.billingModel,
            businessType: m.organizationId.businessType,
            enabledModules: m.organizationId.enabledModules,
            settings: m.organizationId.settings,
            isOnboarded: m.organizationId.isOnboarded,
            onboarding: m.organizationId.onboarding,
          }
        : undefined,
      role: m.role,
      status: m.status,
    })),
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, organizationName, billingModel, businessType } = req.body;

    if (!name || !email || !password || !organizationName) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'All fields are required' },
      });
      return;
    }

    // Email is globally unique so login can deterministically identify a user.
    const existingUser = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists. Please sign in instead.',
        },
      });
      return;
    }

    const bt: BusinessType = businessType || inferBusinessType(billingModel);
    const selectedModel = billingModel || BUSINESS_TYPE_BILLING_MODEL[bt] || 'custom';

    const organization = await OrganizationModel.create({
      name: organizationName,
      slug: await makeUniqueOrgSlug(organizationName),
      billingModel: selectedModel,
      businessType: bt,
      enabledModules: modulesForBusinessType(bt),
      isOnboarded: false,
      onboarding: { currentStep: 1, completedSteps: [], skipped: false },
    });

    // Inject preset custom fields for this billing model
    const preset = BILLING_MODEL_PRESETS[selectedModel];
    if (preset && preset.suggestedCustomFields) {
      for (const field of preset.suggestedCustomFields) {
        await CustomFieldModel.create({
          organizationId: organization._id,
          ...field,
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await UserModel.create({
      organizationId: organization._id,
      name,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    });

    const membership = await MembershipModel.create({
      userId: user._id,
      organizationId: organization._id,
      role: 'admin',
      status: 'active',
    });

    await logAuditEvent({
      organizationId: String(organization._id),
      userId: String(user._id),
      userEmail: user.email,
      action: 'REGISTER_ORGANIZATION',
      entityType: 'Organization',
      entityId: String(organization._id),
      details: { billingModel: selectedModel, businessType: bt },
    });

    const payload = await buildSessionPayload(user, String(organization._id));

    setSessionCookie(res, payload!.token);
    res.status(201).json({
      success: true,
      data: {
        user: { ...payload!.user, role: user.role },
        organization: payload!.organization,
        memberships: payload!.memberships,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required' },
      });
      return;
    }

    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    if (user.isActive === false) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'This account has been deactivated' },
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    await ensureMembership(user);

    const memberships = await MembershipModel.find({
      userId: user._id,
      status: { $ne: 'disabled' },
    });

    // Prefer the user's home organization, otherwise the first active membership.
    let activeOrgId = user.organizationId ? String(user.organizationId) : '';
    if (!activeOrgId || !memberships.some((m) => String(m.organizationId) === activeOrgId)) {
      activeOrgId = memberships[0] ? String(memberships[0].organizationId) : '';
    }

    if (!activeOrgId) {
      res.status(404).json({
        success: false,
        error: { code: 'ORGANIZATION_NOT_FOUND', message: 'No organization membership found for this account' },
      });
      return;
    }

    const payload = await buildSessionPayload(user, activeOrgId);
    if (!payload) {
      res.status(404).json({
        success: false,
        error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Tenant organization not found' },
      });
      return;
    }

    // Keep the home organization in sync with the last active organization.
    if (String(user.organizationId) !== activeOrgId) {
      user.organizationId = new mongoose.Types.ObjectId(activeOrgId);
      await user.save();
    }

    setSessionCookie(res, payload.token);
    const { token: _token, ...session } = payload;
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = req.tenant!;
    const user = await UserModel.findById(tenant.userId).select('-passwordHash');
    const organization = await OrganizationModel.findById(tenant.organizationId);

    if (!user || !organization) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User or tenant not found' },
      });
      return;
    }

    await ensureMembership(user);
    const payload = await buildSessionPayload(user, tenant.organizationId);

    // Reuse the freshly-issued token so the client's role/org stay consistent.
    res.json({
      success: true,
      data: {
        user,
        organization,
        memberships: payload?.memberships || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res);
  res.status(204).end();
}
