import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const categorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    type: { type: String, enum: ['INCOME', 'EXPENSE'], required: true },
    icon: String,
    color: String,
    isSystem: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

configureSchemaSerialization(categorySchema);
export const CategoryModel = mongoose.models.Category || model('Category', categorySchema);
