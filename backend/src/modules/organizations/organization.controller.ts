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
    const { name, settings, enabledModules } = req.body;
    const orgId = req.tenant!.organizationId;

    const updatedOrg = await OrganizationModel.findByIdAndUpdate(
      orgId,
      {
        ...(name && { name }),
        ...(settings && { settings }),
        ...(enabledModules && { enabledModules }),
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
      details: { name, settings },
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
