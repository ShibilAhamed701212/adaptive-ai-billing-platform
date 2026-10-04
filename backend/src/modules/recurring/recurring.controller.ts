import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { RecurringProfileModel } from '../../models/RecurringProfile.model';
import { CustomerModel } from '../../models/Customer.model';
import { executeRecurringProfileGeneration } from '../../jobs/recurring-invoice.job';
import { logAuditEvent } from '../../core/audit/audit.service';
import { pickFields } from '../../core/utils/pick';

const FREQUENCY_ALIASES: Record<string, string> = {
  yearly: 'annual',
  annually: 'annual',
  'semi-annual': 'semi_annual',
  semiannual: 'semi_annual',
  'half-yearly': 'semi_annual',
};

const VALID_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual'];

function normalizeFrequency(frequency: any): string | undefined {
  if (!frequency) return undefined;
  const key = String(frequency).toLowerCase().trim();
  const normalized = FREQUENCY_ALIASES[key] || key;
  return VALID_FREQUENCIES.includes(normalized) ? normalized : undefined;
}

export async function listRecurringProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { status, customerId } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (status) query.status = String(status);
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

    const normalizedFrequency = normalizeFrequency(frequency);

    if (!customerId || !profileName || !items || !Array.isArray(items) || items.length === 0 || !normalizedFrequency) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID, profileName, items, and a valid frequency are required' },
      });
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();

    const profile = await RecurringProfileModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      customerId: new mongoose.Types.ObjectId(customerId),
      profileName,
      items,
      frequency: normalizedFrequency,
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
      details: { profileName, frequency: normalizedFrequency, nextRunDate: profile.nextRunDate },
    });

    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateRecurringProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    // Customer, organization and run counters are fixed once a profile exists.
    const updates: any = pickFields(req.body, [
      'profileName', 'items', 'frequency', 'nextRunDate', 'endDate', 'maxOccurrences', 'autoSend', 'status',
      'invoiceDiscountAmount', 'notes', 'terms', 'customFields',
    ] as const);
    if (updates.status !== undefined && !['active', 'paused', 'cancelled'].includes(updates.status)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be active, paused or cancelled' } });
      return;
    }
    if (updates.items !== undefined && (!Array.isArray(updates.items) || updates.items.length === 0 ||
      updates.items.some((it: any) => !(Number(it?.quantity) > 0) || !(Number(it?.unitPrice) >= 0) || !(Number(it?.taxRate ?? 0) >= 0)))) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Items need a positive quantity and non-negative price and tax' } });
      return;
    }
    if (updates.frequency !== undefined) {
      const normalized = normalizeFrequency(updates.frequency);
      if (!normalized) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid frequency value' } });
        return;
      }
      updates.frequency = normalized;
    }

    const profile = await RecurringProfileModel.findOneAndUpdate(
      { _id: req.params.id, organizationId: new mongoose.Types.ObjectId(orgId) },
      updates,
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
    if (!generatedInvoice) {
      res.status(409).json({ success: false, error: { code: 'ALREADY_INVOICED', message: 'This billing period was already invoiced, or the profile is not active' } });
      return;
    }

    res.json({
      success: true,
      message: 'Recurring invoice generated successfully',
      data: generatedInvoice,
    });
  } catch (err) {
    next(err);
  }
}
