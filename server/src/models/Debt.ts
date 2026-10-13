import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const debtSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    personName: { type: String, required: true },
    type: { type: String, enum: ['BORROWED', 'LENT'], required: true },
    principalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    note: String,
    status: { type: String, enum: ['ACTIVE', 'PAID', 'OVERDUE'], default: 'ACTIVE' },
  },
  { timestamps: true },
);

configureSchemaSerialization(debtSchema);
export const DebtModel = mongoose.models.Debt || model('Debt', debtSchema);
