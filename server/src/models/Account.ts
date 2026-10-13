import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const accountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['CASH', 'BANK', 'EWALLET', 'OTHER'], default: 'CASH' },
    openingBalance: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'VND' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

accountSchema.index({ userId: 1, isArchived: 1 });
configureSchemaSerialization(accountSchema);

export const AccountModel = mongoose.models.Account || model('Account', accountSchema);
