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
