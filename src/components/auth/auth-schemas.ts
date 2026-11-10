import { z } from "zod"
import { DEMO_MODE } from "@/lib/api/config"
import { demoEmails } from "@/lib/demo-api"
import { today } from "@/lib/format"
import { useAppStore } from "@/lib/store"

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

/** Sign up and new passwords meet all four rules (V2.1 prototype: "doesn't meet all the rules yet"). */
const strongPassword = z.string().refine((v) => passwordChecks(v).every(Boolean), "passwordRules")

/** Birth years run from this year back to 1940 (the demo's "today" is pinned to 2026-11-05). */
export const THIS_YEAR = DEMO_MODE ? Number(today.slice(0, 4)) : new Date().getFullYear()
export const ageFrom = (year: string) => (year ? THIS_YEAR - Number(year) : 0)

/** Demo: the demo accounts and accounts made on this device already exist (the real API answers email_taken). */
const takenInDemo = (value: string) => {
  if (!DEMO_MODE) return false
  const e = value.trim().toLowerCase()
  return demoEmails().includes(e) || useAppStore.getState().accounts.some((a) => a.email.toLowerCase() === e)
}

// `when: () => true`: zod skips object-level checks while a field has an error; the design shows
// "Passwords don't match" together with the other errors.
const confirmMatches = { message: "mismatch", path: ["confirm"], when: () => true }

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "nameRequired").max(20, "nameRequired"),
    email: email.refine((v) => !takenInDemo(v), "emailTaken"),
    password: strongPassword,
    confirm: z.string(),
    ui: z.enum(["en", "km"]),
    year: z
      .string()
      .min(1, "yearRequired")
      .refine((v) => !v || ageFrom(v) >= 13, "tooYoung"),
    terms: z.boolean().refine((v) => v, "termsRequired"),
  })
  .refine((v) => v.confirm === v.password, confirmMatches)
export type SignupValues = z.infer<typeof signupSchema>

export const forgotSchema = z.object({ email })
export type ForgotValues = z.infer<typeof forgotSchema>

export const newPasswordSchema = z
  .object({ password: strongPassword, confirm: z.string() })
  .refine((v) => v.confirm === v.password, confirmMatches)
export type NewPasswordValues = z.infer<typeof newPasswordSchema>
