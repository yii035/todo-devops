import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['INCOME', 'EXPENSE', 'TRANSFER'], required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    destinationAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    transactionDate: { type: Date, required: true },
    note: String,
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, type: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, accountId: 1, transactionDate: -1 });
configureSchemaSerialization(transactionSchema);

export const TransactionModel = mongoose.models.Transaction || model('Transaction', transactionSchema);
