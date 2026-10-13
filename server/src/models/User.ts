import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatarUrl: String,
    defaultCurrency: { type: String, default: 'VND' },
  },
  { timestamps: true },
);

configureSchemaSerialization(userSchema);
export const UserModel = mongoose.models.User || model('User', userSchema);
