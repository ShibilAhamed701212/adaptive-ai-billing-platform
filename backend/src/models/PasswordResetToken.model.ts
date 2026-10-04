import mongoose, { Schema, Document } from 'mongoose';

export interface IPasswordResetTokenDoc extends Document {
  userId: mongoose.Types.ObjectId;
  /** SHA-256 of the emailed token; the raw token is never stored. */
  tokenHash: string;
  expiresAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    // TTL index: MongoDB removes expired tokens automatically.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export const PasswordResetTokenModel = mongoose.model<IPasswordResetTokenDoc>('PasswordResetToken', PasswordResetTokenSchema);
