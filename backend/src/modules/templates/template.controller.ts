import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { InvoiceTemplateModel } from '../../models/InvoiceTemplate.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const templates = await InvoiceTemplateModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) }).sort({ isDefault: -1, createdAt: 1 });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { templateName, description, layout, brandColors, fontFamily, isDefault } = req.body;

    if (!templateName) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Template name is required' } });
      return;
    }

    if (isDefault) {
      await InvoiceTemplateModel.updateMany({ organizationId: new mongoose.Types.ObjectId(orgId) }, { isDefault: false });
    }

    const template = await InvoiceTemplateModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      templateName,
      description,
      layout: layout || {},
      brandColors: brandColors || {},
      fontFamily: fontFamily || 'Inter, sans-serif',
      isDefault: Boolean(isDefault),
    });

    await logAuditEvent({
      organizationId: orgId,
      userId: req.tenant!.userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_INVOICE_TEMPLATE',
      entityType: 'InvoiceTemplate',
      entityId: String(template._id),
      details: { templateName },
    });

    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const templateId = req.params.id;
    const { isDefault } = req.body;

    if (isDefault) {
      await InvoiceTemplateModel.updateMany(
        { organizationId: new mongoose.Types.ObjectId(orgId), _id: { $ne: templateId } },
        { isDefault: false }
      );
    }

    const template = await InvoiceTemplateModel.findOneAndUpdate(
      { _id: templateId, organizationId: new mongoose.Types.ObjectId(orgId) },
      req.body,
      { new: true }
    );

    if (!template) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
      return;
    }

    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const template = await InvoiceTemplateModel.findOneAndDelete({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!template) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
      return;
    }

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err) {
    next(err);
  }
}
