import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../../models/User.model';
import { OrganizationModel } from '../../models/Organization.model';
import { CustomFieldModel } from '../../models/CustomField.model';
import { BILLING_MODEL_PRESETS } from '../../billing-engine/billing-models/presets';
import { ENV } from '../../config/env';
import { logAuditEvent } from '../../core/audit/audit.service';
import mongoose from 'mongoose';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, organizationName, billingModel } = req.body;

    if (!name || !email || !password || !organizationName) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'All fields are required' },
      });
      return;
    }

    const selectedModel = billingModel || 'retail';
    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);

    // Create Organization
    const organization = await OrganizationModel.create({
      name: organizationName,
      slug,
      billingModel: selectedModel,
      enabledModules: ['invoices', 'customers', 'products', 'payments', 'reports', 'ai_copilot'],
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

    // Hash Password & create Admin user
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

    // Generate JWT
    const token = jwt.sign(
      {
        organizationId: String(organization._id),
        userId: String(user._id),
        role: user.role,
        email: user.email,
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAuditEvent({
      organizationId: String(organization._id),
      userId: String(user._id),
      userEmail: user.email,
      action: 'REGISTER_ORGANIZATION',
      entityType: 'Organization',
      entityId: String(organization._id),
      details: { billingModel: selectedModel },
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        organization: {
          _id: organization._id,
          name: organization.name,
          slug: organization.slug,
          billingModel: organization.billingModel,
          settings: organization.settings,
        },
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const organization = await OrganizationModel.findById(user.organizationId);
    if (!organization) {
      res.status(404).json({
        success: false,
        error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Tenant organization not found' },
      });
      return;
    }

    const token = jwt.sign(
      {
        organizationId: String(organization._id),
        userId: String(user._id),
        role: user.role,
        email: user.email,
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        organization: {
          _id: organization._id,
          name: organization.name,
          slug: organization.slug,
          billingModel: organization.billingModel,
          settings: organization.settings,
        },
      },
    });
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

    res.json({
      success: true,
      data: {
        user,
        organization,
      },
    });
  } catch (err) {
    next(err);
  }
}
