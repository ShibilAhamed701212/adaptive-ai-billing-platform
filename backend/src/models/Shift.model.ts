import mongoose, { Schema, Document } from 'mongoose';
import { Shift as IShiftData } from '@billing/shared';

export interface IShiftDoc extends Document, Omit<IShiftData, '_id' | 'organizationId' | 'userId'> {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

const ShiftSchema = new Schema<IShiftDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true },
    startTime: { type: String, required: true },
    endTime: { type: String },
    openingCash: { type: Number, required: true },
    expectedCash: { type: Number },
    actualCash: { type: Number },
    difference: { type: Number },
    totals: {
      cashSales: { type: Number, default: 0 },
      cardSales: { type: Number, default: 0 },
      upiSales: { type: Number, default: 0 },
      creditSales: { type: Number, default: 0 },
      refunds: { type: Number, default: 0 },
      expenses: { type: Number, default: 0 },
    },
    notes: { type: String },
  },
  { timestamps: true }
);

export const ShiftModel = mongoose.model<IShiftDoc>('Shift', ShiftSchema);
