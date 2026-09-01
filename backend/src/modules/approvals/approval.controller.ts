import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApprovalQueueModel } from '../../models/ApprovalQueue.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { CustomerModel } from '../../models/Customer.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { status = 'pending' } = req.query;

    const items = await ApprovalQueueModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      status,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function approveItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { reviewNotes } = req.body;

    const item = await ApprovalQueueModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!item) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Approval request not found' } });
      return;
    }

    if (item.status !== 'pending') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_PROCESSED', message: `Request is already ${item.status}` } });
      return;
    }

    item.status = 'approved';
    item.reviewedBy = new mongoose.Types.ObjectId(userId);
    item.reviewedByEmail = req.tenant!.email;
    item.reviewedAt = new Date();
    item.reviewNotes = reviewNotes;
    await item.save();

    // If invoice, transition status from pending_approval to approved/sent
    if (item.entityType === 'invoice') {
      const invoice = await InvoiceModel.findById(item.entityId);
      if (invoice) {
        invoice.status = 'approved';
        await invoice.save();
        await CustomerModel.findByIdAndUpdate(invoice.customerId, {
          $inc: { outstandingBalance: invoice.amountDue },
        });
      }
    }

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'APPROVE_ITEM',
      entityType: 'ApprovalQueue',
      entityId: String(item._id),
      details: { entityType: item.entityType, entityId: String(item.entityId) },
    });

    res.json({ success: true, message: 'Item approved successfully', data: item });
  } catch (err) {
    next(err);
  }
}

export async function rejectItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { reviewNotes } = req.body;

    const item = await ApprovalQueueModel.findOne({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!item) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Approval request not found' } });
      return;
    }

    item.status = 'rejected';
    item.reviewedBy = new mongoose.Types.ObjectId(userId);
    item.reviewedByEmail = req.tenant!.email;
    item.reviewedAt = new Date();
    item.reviewNotes = reviewNotes || 'Rejected by manager';
    await item.save();

    if (item.entityType === 'invoice') {
      await InvoiceModel.findByIdAndUpdate(item.entityId, { status: 'draft' });
    }

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'REJECT_ITEM',
      entityType: 'ApprovalQueue',
      entityId: String(item._id),
      details: { entityType: item.entityType, entityId: String(item.entityId), reason: item.reviewNotes },
    });

    res.json({ success: true, message: 'Item rejected', data: item });
  } catch (err) {
    next(err);
  }
}
