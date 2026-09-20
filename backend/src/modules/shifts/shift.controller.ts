import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ShiftModel } from '../../models/Shift.model';
import { InvoiceModel } from '../../models/Invoice.model';
import { ExpenseModel } from '../../models/Expense.model';
import { logAuditEvent } from '../../core/audit/audit.service';

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

    // Tally live shift metrics
    const invoices = await InvoiceModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      shiftId: current._id,
    }).lean();

    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let creditSales = 0;

    for (const inv of invoices) {
      if (inv.amountDue > 0) {
        creditSales += inv.amountDue;
      }
      if (inv.paymentHistory) {
        for (const p of inv.paymentHistory) {
          if (p.method === 'cash') cashSales += p.amount;
          else if (p.method === 'card' || p.method === 'credit_card') cardSales += p.amount;
          else if (p.method === 'upi') upiSales += p.amount;
        }
      }
    }

    const expensesList = await ExpenseModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      shiftId: current._id,
    }).lean();
    const totalExpenses = expensesList.reduce((sum, e) => sum + e.amount, 0);

    const expectedCash = (current.openingCash || 0) + cashSales - totalExpenses;

    res.json({
      success: true,
      data: {
        ...current,
        liveMetrics: {
          cashSales,
          cardSales,
          upiSales,
          creditSales,
          expenses: totalExpenses,
          expectedCash,
          invoiceCount: invoices.length,
        },
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

    if (actualCash === undefined || isNaN(Number(actualCash))) {
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

    // Tally up sales made during this shift
    const invoices = await InvoiceModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      shiftId: shift._id,
    });

    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let creditSales = 0;

    for (const inv of invoices) {
      if (inv.amountDue > 0) {
        creditSales += inv.amountDue;
      }
      if (inv.paymentHistory) {
        for (const p of inv.paymentHistory) {
          if (p.method === 'cash') cashSales += p.amount;
          else if (p.method === 'card' || p.method === 'credit_card') cardSales += p.amount;
          else if (p.method === 'upi') upiSales += p.amount;
        }
      }
    }

    // Tally up expenses logged during this shift
    const expensesList = await ExpenseModel.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      shiftId: shift._id,
    });
    const totalExpenses = expensesList.reduce((sum, e) => sum + e.amount, 0);

    const expectedCash = shift.openingCash + cashSales - totalExpenses;
    const difference = Number(actualCash) - expectedCash;

    shift.status = 'CLOSED';
    shift.endTime = new Date().toISOString();
    shift.actualCash = Number(actualCash);
    shift.expectedCash = expectedCash;
    shift.difference = difference;
    shift.totals = {
      cashSales,
      cardSales,
      upiSales,
      creditSales,
      refunds: 0,
      expenses: totalExpenses,
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

    const skip = (Number(page) - 1) * Number(limit);
    const [shifts, total] = await Promise.all([
      ShiftModel.find({ organizationId: new mongoose.Types.ObjectId(orgId) })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ShiftModel.countDocuments({ organizationId: new mongoose.Types.ObjectId(orgId) }),
    ]);

    res.json({
      success: true,
      data: shifts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}
