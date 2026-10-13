import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const debtPaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    debtId: { type: Schema.Types.ObjectId, ref: 'Debt', required: true },
    amount: { type: Number, required: true, min: 1 },
    paymentDate: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

debtPaymentSchema.index({ userId: 1, debtId: 1, paymentDate: -1 });
configureSchemaSerialization(debtPaymentSchema);

export const DebtPaymentModel = mongoose.models.DebtPayment || model('DebtPayment', debtPaymentSchema);
