import mongoose, { Schema, Document } from 'mongoose';

export interface ITimesheet extends Document {
  organizationId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  hours: number;
  description: string;
  isBillable: boolean;
  rate?: number;
  status: 'draft' | 'submitted' | 'approved' | 'invoiced';
  invoiceId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TimesheetSchema = new Schema<ITimesheet>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    hours: { type: Number, required: true },
    description: { type: String, required: true },
    isBillable: { type: Boolean, default: true },
    rate: { type: Number },
    status: { type: String, enum: ['draft', 'submitted', 'approved', 'invoiced'], default: 'draft' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  },
  { timestamps: true }
);

export const TimesheetModel = mongoose.model<ITimesheet>('Timesheet', TimesheetSchema);
