import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const budgetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    amountLimit: { type: Number, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
  },
  { timestamps: true },
);

budgetSchema.index({ userId: 1, categoryId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
configureSchemaSerialization(budgetSchema);

export const BudgetModel = mongoose.models.Budget || model('Budget', budgetSchema);
