import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { RecurringProfileModel } from '../../models/RecurringProfile.model';
import { CustomerModel } from '../../models/Customer.model';
import { executeRecurringProfileGeneration } from '../../jobs/recurring-invoice.job';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listRecurringProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { status, customerId } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (status) query.status = status;
    if (customerId) query.customerId = new mongoose.Types.ObjectId(String(customerId));

    const profiles = await RecurringProfileModel.find(query)
      .populate('customerId', 'name companyName email')
      .sort({ nextRunDate: 1 });

    res.json({ success: true, data: profiles });
  } catch (err) {
    next(err);
  }
}

export async function createRecurringProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const {
      customerId,
      profileName,
      items,
      frequency,
      startDate,
      endDate,
      maxOccurrences,
      autoSend,
      invoiceDiscountAmount,
      notes,
      terms,
      customFields,
    } = req.body;

    if (!customerId || !profileName || !items || !Array.isArray(items) || items.length === 0 || !frequency) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID, profileName, items, and frequency are required' },
      });
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();

    const profile = await RecurringProfileModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      customerId: new mongoose.Types.ObjectId(customerId),
      profileName,
      items,
      frequency,
      nextRunDate: start,
      startDate: start,
      endDate: endDate ? new Date(endDate) : undefined,
      maxOccurrences: maxOccurrences ? Number(maxOccurrences) : undefined,
      autoSend: Boolean(autoSend),
      invoiceDiscountAmount: Number(invoiceDiscountAmount) || 0,
      notes,
      terms,
      customFields: customFields || {},
      status: 'active',
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_RECURRING_PROFILE',
      entityType: 'RecurringProfile',
      entityId: String(profile._id),
      details: { profileName, frequency, nextRunDate: profile.nextRunDate },
    });

    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateRecurringProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const profile = await RecurringProfileModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      req.body,
      { new: true }
    );

    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recurring profile not found' } });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function triggerManualRun(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const profile = await RecurringProfileModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recurring profile not found' } });
      return;
    }

    const generatedInvoice = await executeRecurringProfileGeneration(profile);

    res.json({
      success: true,
      message: 'Recurring invoice generated successfully',
      data: generatedInvoice,
    });
  } catch (err) {
    next(err);
  }
}
