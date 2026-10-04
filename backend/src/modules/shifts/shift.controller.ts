import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ShiftModel } from '../../models/Shift.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { ExpenseModel } from '../../models/Expense.model';
import { logAuditEvent } from '../../core/audit/audit.service';
import { parsePagination } from '../../core/utils/query';
import { ReturnModel } from '../../models/Return.model';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Money that moved through this cashier's drawer during the shift: sales by method, expenses,
 * and cash paid out (or taken in) by returns and exchanges. Shared by live metrics and closing.
 */
async function tallyShift(orgId: string, shift: { _id: any; userId: any; startTime: string; openingCash?: number }) {
  const orgObjId = new mongoose.Types.ObjectId(orgId);
  const [invoices, expensesList, returns] = await Promise.all([
    InvoiceModel.find({ organizationId: orgObjId, shiftId: shift._id }).lean(),
    ExpenseModel.find({ organizationId: orgObjId, shiftId: shift._id }).lean(),
    ReturnModel.find({ organizationId: orgObjId, userId: shift.userId, createdAt: { $gte: new Date(shift.startTime) } }).lean(),
  ]);

  let cashSales = 0;
  let cardSales = 0;
  let upiSales = 0;
  let creditSales = 0;
  for (const inv of invoices) {
    if (inv.amountDue > 0) creditSales += inv.amountDue;
    for (const p of inv.paymentHistory || []) {
      if (p.method === 'cash') cashSales += p.amount;
      else if (p.method === 'card' || p.method === 'credit_card') cardSales += p.amount;
      else if (p.method === 'upi') upiSales += p.amount;
    }
  }
  const totalExpenses = expensesList.reduce((sum, e) => sum + e.amount, 0);

  // Cash leaving the drawer for returns (net of cash collected on exchanges).
  let cashRefunds = 0;
  for (const r of returns as any[]) {
    if (r.isExchange) {
      const via = r.exchangeDetails?.differenceSettledVia || r.refundMethod;
      if (via === 'cash') cashRefunds -= r.exchangeDetails?.difference || 0; // +difference = customer paid in
    } else if (r.refundMethod === 'cash') {
      cashRefunds += r.totalRefundAmount || 0;
    }
  }

  const expectedCash = round2((shift.openingCash || 0) + cashSales - totalExpenses - cashRefunds);
  return {
    invoiceCount: invoices.length,
    cashSales: round2(cashSales),
    cardSales: round2(cardSales),
    upiSales: round2(upiSales),
    creditSales: round2(creditSales),
    expenses: round2(totalExpenses),
    refunds: round2(cashRefunds),
    expectedCash,
  };
}

export async function getCurrentShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;

    const current = await ShiftModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'OPEN',
    }).lean();

    if (!current) {
      res.json({ success: true, data: null });
      return;
    }

    const liveMetrics = await tallyShift(orgId, current as any);

    res.json({
      success: true,
      data: {
        ...current,
        liveMetrics,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function openShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { openingCash = 0, notes } = req.body;
    if (!Number.isFinite(Number(openingCash)) || Number(openingCash) < 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Opening cash must be zero or more' } });
      return;
    }

    // Check if shift already open
    const existing = await ShiftModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'OPEN',
    });

    if (existing) {
      res.status(400).json({
        success: false,
        error: { code: 'SHIFT_ALREADY_OPEN', message: 'You already have an open shift' },
        data: existing,
      });
      return;
    }

    const shift = await ShiftModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'OPEN',
      startTime: new Date().toISOString(),
      openingCash: Number(openingCash),
      notes,
      totals: {
        cashSales: 0,
        cardSales: 0,
        upiSales: 0,
        creditSales: 0,
        refunds: 0,
        expenses: 0,
      },
    });

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'OPEN_SHIFT',
      entityType: 'Shift',
      entityId: String(shift._id),
      details: { openingCash: shift.openingCash },
    });

    res.status(201).json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

export async function closeShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { actualCash, notes } = req.body;

    if (actualCash === undefined || actualCash === '' || !Number.isFinite(Number(actualCash)) || Number(actualCash) < 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Actual cash in drawer is required to close shift' } });
      return;
    }

    const shift = await ShiftModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'OPEN',
    });

    if (!shift) {
      res.status(404).json({ success: false, error: { code: 'NO_OPEN_SHIFT', message: 'No open shift found to close' } });
      return;
    }

    const tally = await tallyShift(orgId, shift as any);
    const expectedCash = tally.expectedCash;
    const difference = round2(Number(actualCash) - expectedCash);

    shift.status = 'CLOSED';
    shift.endTime = new Date().toISOString();
    shift.actualCash = Number(actualCash);
    shift.expectedCash = expectedCash;
    shift.difference = difference;
    shift.totals = {
      cashSales: tally.cashSales,
      cardSales: tally.cardSales,
      upiSales: tally.upiSales,
      creditSales: tally.creditSales,
      refunds: tally.refunds,
      expenses: tally.expenses,
    };
    if (notes) shift.notes = (shift.notes ? `${shift.notes} | ` : '') + notes;

    await shift.save();

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'CLOSE_SHIFT',
      entityType: 'Shift',
      entityId: String(shift._id),
      details: { expectedCash, actualCash: shift.actualCash, difference },
    });

    res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

export async function listShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { page = 1, limit = 50 } = req.query;

    const { page: pageNum, limit: pageSize, skip } = parsePagination(page, limit);
    const [shifts, total] = await Promise.all([
      ShiftModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      ShiftModel.countDocuments({ organizationId: new mongoose.Types.ObjectId(orgId) }),
    ]);

    res.json({
      success: true,
      data: shifts,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
}
