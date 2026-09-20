import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ExpenseModel } from '../../models/Expense.model';
import { ShiftModel } from '../../models/Shift.model';
import { logAuditEvent } from '../../core/audit/audit.service';

export async function listExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const { category, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query: any = { organizationId: new mongoose.Types.ObjectId(orgId) };
    if (category) query.category = category;
    if (startDate && endDate) {
      query.date = { $gte: String(startDate), $lte: String(endDate) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [expenses, total] = await Promise.all([
      ExpenseModel.find(query).populate('userId', 'name email').sort({ date: -1 }).skip(skip).limit(Number(limit)),
      ExpenseModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: expenses,
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

export async function createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const userId = req.tenant!.userId;
    const { category, amount, description, date, receiptUrl } = req.body;

    if (!category || !amount || Number(amount) <= 0 || !description) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Category, positive amount, and description are required' } });
      return;
    }

    // Auto-detect open shift for this user if applicable
    const activeShift = await ShiftModel.findOne({
      organizationId: new mongoose.Types.ObjectId(orgId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'OPEN',
    });

    const expense = await ExpenseModel.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      userId: new mongoose.Types.ObjectId(userId),
      shiftId: activeShift ? activeShift._id : undefined,
      category: String(category).trim(),
      amount: Number(amount),
      date: date || new Date().toISOString().split('T')[0],
      description: String(description).trim(),
      receiptUrl,
    });

    await logAuditEvent({
      organizationId: orgId,
      userId,
      userEmail: req.tenant!.email,
      action: 'CREATE_EXPENSE',
      entityType: 'Expense',
      entityId: String(expense._id),
      details: { category: expense.category, amount: expense.amount, description: expense.description },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.tenant!.organizationId;
    const expense = await ExpenseModel.findOneAndDelete({
      _id: req.params.id,
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!expense) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } });
      return;
    }

    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
}
