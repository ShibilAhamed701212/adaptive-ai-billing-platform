import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApprovalQueueModel } from '../../models/ApprovalQueue.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { CustomerModel } from '../../models/Customer.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const status = String(req.query.status || 'pending');

    const items = await ApprovalQueueModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      status,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

/**
 * Atomically move a pending request to its decision. Only one reviewer can win: concurrent
 * approve/approve or approve/reject clicks must not apply side effects twice.
 */
async function claimPendingItem(req: Request, decision: 'approved' | 'rejected', reviewNotes: string | undefined) {
  const orgId = new mongoose.Types.ObjectId(req.tenant!.organizationId);
  const claimed = await ApprovalQueueModel.findOneAndUpdate(
    { _id: req.params.id, organizationId: orgId, status: 'pending' },
    {
      $set: {
        status: decision,
        reviewedBy: new mongoose.Types.ObjectId(req.tenant!.userId),
        reviewedByEmail: req.tenant!.email,
        reviewedAt: new Date(),
        reviewNotes,
      },
    },
    { new: true }
  );
  if (claimed) return { item: claimed };
  const existing = await ApprovalQueueModel.findOne({ _id: req.params.id, organizationId: orgId }).select('status');
  return existing
    ? { error: { status: 409, code: 'ALREADY_PROCESSED', message: `Request is already ${existing.status}` } }
    : { error: { status: 404, code: 'NOT_FOUND', message: 'Approval request not found' } };
}

export async function approveItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { reviewNotes } = req.body;

    const claim = await claimPendingItem(req, 'approved', reviewNotes);
    if (claim.error) {
      res.status(claim.error.status).json({ success: false, error: { code: claim.error.code, message: claim.error.message } });
      return;
    }
    const item = claim.item!;

    // Only an invoice still awaiting approval becomes a receivable (it may have been cancelled meanwhile).
    if (item.entityType === 'invoice') {
      const invoice = await InvoiceModel.findOneAndUpdate(
        { _id: item.entityId, organizationId: new mongoose.Types.ObjectId(orgId), status: 'pending_approval' },
        { $set: { status: 'approved' } },
        { new: true }
      );
      if (invoice) {
        await CustomerModel.updateOne(
          { _id: invoice.customerId, organizationId: new mongoose.Types.ObjectId(orgId) },
          { $inc: { outstandingBalance: invoice.amountDue } }
        );
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

    // Rejecting is only valid while pending: rejecting an approved (maybe paid) invoice would
    // send it back to draft while its balance stayed on the customer's account.
    const claim = await claimPendingItem(req, 'rejected', reviewNotes || 'Rejected by manager');
    if (claim.error) {
      res.status(claim.error.status).json({ success: false, error: { code: claim.error.code, message: claim.error.message } });
      return;
    }
    const item = claim.item!;

    if (item.entityType === 'invoice') {
      await InvoiceModel.updateOne(
        { _id: item.entityId, organizationId: new mongoose.Types.ObjectId(orgId), status: 'pending_approval' },
        { $set: { status: 'draft' } }
      );
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
