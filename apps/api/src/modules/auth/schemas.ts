import z from 'zod'
import { USERNAME_PATTERN } from '@/modules/users/username.js'

export const PasswordScheme = z.string().min(8).max(128)

export const LoginBodyScheme = z.object({
  username: z.string().trim().regex(USERNAME_PATTERN),
  password: PasswordScheme,
})
