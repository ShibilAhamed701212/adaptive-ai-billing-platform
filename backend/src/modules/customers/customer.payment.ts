import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { CustomerModel } from '../../models/Customer.model';
import { LedgerTransactionModel } from '../../models/LedgerTransaction.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function recordCustomerPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const customerId = req.params.id;
    const { amount, method, notes, reference } = req.body;

    if (!amount || amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const customer = await CustomerModel.findOne({
      _id: customerId,
      organizationId: new mongoose.Types.ObjectId(orgId),
    }).session(session);

    if (!customer) {
      throw new Error('Customer not found');
    }

    const balanceAfter = customer.outstandingBalance - amount;
    customer.outstandingBalance = balanceAfter;
    await customer.save({ session });

    const ledger = new LedgerTransactionModel({
      organizationId: new mongoose.Types.ObjectId(orgId),
      customerId: customer._id,
      type: 'PAYMENT',
      amount: -amount,
      balanceAfter,
      notes: notes || `Payment via ${method}`,
      referenceId: reference,
      date: new Date().toISOString()
    });
    await ledger.save({ session });

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'CUSTOMER_PAYMENT',
      entityType: 'Customer',
      entityId: String(customer._id),
      details: { amount, method, reference, balanceAfter },
    });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, data: { customer, transaction: ledger } });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
}
