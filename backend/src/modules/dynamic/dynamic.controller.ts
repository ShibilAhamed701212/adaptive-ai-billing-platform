import { Request, Response, NextFunction } from 'express';
import { CustomFieldModel } from '../../models/CustomField.model';
import { BusinessRuleModel } from '../../models/BusinessRule.model';
import { BILLING_MODEL_PRESETS } from '../../billing-engine/billing-models/presets';
import { logAuditEvent } from '../../core/audit/audit.service';
import mongoose from 'mongoose';

export async function listCustomFields(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { targetEntity } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (targetEntity) {
      query.targetEntity = targetEntity;
    }

    const fields = await CustomFieldModel.find(query).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: fields });
  } catch (err) {
    next(err);
  }
}

export async function createCustomField(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { targetEntity, fieldName, label, fieldType, required, options, placeholder, validationRegex, isSearchable, order } = req.body;

    if (!targetEntity || !fieldName || !label || !fieldType) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Target entity, fieldName, label, and fieldType are required' },
      });
      return;
    }

    // Clean field name
    const sanitizedKey = fieldName.replace(/[^a-zA-Z0-9_]/g, '');

    const existing = await CustomFieldModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetEntity,
      fieldName: sanitizedKey,
    });

    if (existing) {
      res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_FIELD', message: `Field '${sanitizedKey}' already exists for ${targetEntity}` },
      });
      return;
    }

    const field = await CustomFieldModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      targetEntity,
      fieldName: sanitizedKey,
      label,
      fieldType,
      required: Boolean(required),
      options: options || [],
      placeholder,
      validationRegex,
      isSearchable: Boolean(isSearchable),
      order: Number(order) || 0,
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_CUSTOM_FIELD',
      entityType: 'CustomFieldDefinition',
      entityId: String(field._id),
      details: { targetEntity, fieldName: sanitizedKey, label },
    });

    res.status(201).json({ success: true, data: field });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomField(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const field = await CustomFieldModel.findOneAndDelete({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!field) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Field definition not found' } });
      return;
    }

    res.json({ success: true, message: 'Custom field deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function listBusinessRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const rules = await BusinessRuleModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) }).sort({ createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
}

export async function createBusinessRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { ruleName, description, event, condition, action } = req.body;

    if (!ruleName || !event || !condition || !action) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Rule name, event, condition, and action are required' },
      });
      return;
    }

    const rule = await BusinessRuleModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      ruleName,
      description,
      event,
      condition,
      action,
      isActive: true,
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_BUSINESS_RULE',
      entityType: 'BusinessRule',
      entityId: String(rule._id),
      details: { ruleName, event },
    });

    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
}

export async function deleteBusinessRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const rule = await BusinessRuleModel.findOneAndDelete({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!rule) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business rule not found' } });
      return;
    }

    res.json({ success: true, message: 'Business rule deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export function getBillingPresets(req: Request, res: Response): void {
  res.json({
    success: true,
    data: Object.values(BILLING_MODEL_PRESETS),
  });
}
