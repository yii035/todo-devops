import type { Schema } from 'mongoose';

export const configureSchemaSerialization = (schema: Schema) => {
  schema.set('toJSON', {
    virtuals: true,
    transform: (_document, result: Record<string, unknown>) => {
      if (result._id) result.id = String(result._id);
      delete result._id;
      delete result.__v;
      delete result.passwordHash;
      return result;
    },
  });
};
