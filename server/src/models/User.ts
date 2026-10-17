import mongoose, { Schema, model } from 'mongoose';
import { configureSchemaSerialization } from './configureSchema.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String, default: '/avatar-default.png' },
    phoneNumber: { type: String, trim: true, default: '' },
    birthDate: Date,
    defaultCurrency: { type: String, default: 'VND' },
  },
  { timestamps: true },
);

configureSchemaSerialization(userSchema);
export const UserModel = mongoose.models.User || model('User', userSchema);
