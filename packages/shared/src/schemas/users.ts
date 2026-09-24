import { z } from 'zod';
import { Role } from '../enums';
import { emailSchema, optionalText, paginationQuerySchema, phoneSchema, requiredText, booleanQuery } from './common';
import { passwordSchema } from './auth';

export const createUserSchema = z.object({
  fullName: requiredText(120, 'El nombre'),
  email: emailSchema,
  role: z.enum(Role),
  phone: phoneSchema,
  jobTitle: optionalText(80),
  password: passwordSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: requiredText(120, 'El nombre').optional(),
  role: z.enum(Role).optional(),
  phone: phoneSchema.optional(),
  jobTitle: optionalText(80).optional(),
  password: passwordSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userStatusSchema = z.object({ active: z.boolean() });
export type UserStatusInput = z.infer<typeof userStatusSchema>;

export const userListQuerySchema = paginationQuerySchema.extend({
  role: z.enum(Role).optional(),
  active: booleanQuery,
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;
