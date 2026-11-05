import { z } from "zod"

// Messages are keys in the `auth` namespace; the views translate them.
const email = z
  .string()
  .trim()
  .min(1, "emailRequired")
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "emailInvalid")

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "passwordRequired"),
  remember: z.boolean(),
})
export type LoginValues = z.infer<typeof loginSchema>

/** The four password rules, in the order of `auth.rule0..3`. */
export const passwordChecks = (password: string): boolean[] => [
  password.length >= 8,
  /[a-z]/.test(password) && /[A-Z]/.test(password),
  /\d/.test(password),
  /[^A-Za-z0-9\s]/.test(password),
]

export const signupSchema = z.object({
  name: z.string().trim().min(2, "nameRequired"),
  email,
  // at least 3 of the 4 rules (the strength bar turns green at 3)
  password: z.string().refine((v) => passwordChecks(v).filter(Boolean).length >= 3, "passwordWeak"),
  terms: z.boolean().refine((v) => v, "termsRequired"),
})
export type SignupValues = z.infer<typeof signupSchema>

export const forgotSchema = z.object({ email })
export type ForgotValues = z.infer<typeof forgotSchema>
