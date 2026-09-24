import { z } from 'zod';
import { emailSchema } from './common';

export const PASSWORD_MIN_LENGTH = 10;

export const passwordSchema = z
  .string({ message: 'La contraseña es obligatoria.' })
  .min(PASSWORD_MIN_LENGTH, { message: `La contraseña debe tener mínimo ${PASSWORD_MIN_LENGTH} caracteres.` })
  .max(128, { message: 'La contraseña es demasiado larga.' })
  .refine((v) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(v) && /\d/.test(v), {
    message: 'La contraseña debe combinar letras y números.',
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'La contraseña es obligatoria.' }).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
