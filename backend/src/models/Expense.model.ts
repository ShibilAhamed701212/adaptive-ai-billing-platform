import mongoose, { Schema, Document } from 'mongoose';
import { Expense as IExpenseData } from '@billing/shared';

export interface IExpenseDoc extends Document, Omit<IExpenseData, '_id' | 'organizationId' | 'userId' | 'shiftId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  shiftId?: mongoose.Types.ObjectId;
}

const ExpenseSchema = new Schema<IExpenseDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', index: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    receiptUrl: String,
  },
  { timestamps: true }
);

ExpenseSchema.index({ organizationId: 1, date: -1 });

export const ExpenseModel = mongoose.model<IExpenseDoc>('Expense', ExpenseSchema);
