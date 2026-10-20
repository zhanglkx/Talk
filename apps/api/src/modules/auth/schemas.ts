import z from 'zod'
import { USERNAME_PATTERN } from '@/modules/users/username.js'

export const PasswordSchema = z.string().min(12).max(128)

export const LoginBodySchema = z.object({
  username: z.string().trim().regex(USERNAME_PATTERN),
  password: PasswordSchema,
})
