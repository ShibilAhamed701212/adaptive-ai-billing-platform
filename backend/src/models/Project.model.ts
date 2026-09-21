import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  organizationId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  name: string;
  startDate?: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  budget?: number;
  hourlyRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    name: { type: String, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'completed', 'on_hold', 'cancelled'], default: 'active' },
    budget: { type: Number },
    hourlyRate: { type: Number },
  },
  { timestamps: true }
);

export const ProjectModel = mongoose.model<IProject>('Project', ProjectSchema);
