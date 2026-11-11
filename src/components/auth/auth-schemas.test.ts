import { describe, expect, it } from "vitest"
import { forgotSchema, loginSchema, newPasswordSchema, passwordChecks, signupSchema } from "./auth-schemas"

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues.map((i) => i.message) ?? [])

describe("passwordChecks", () => {
  it("reports the four rules in order: length, upper + lower, digit, symbol", () => {
    expect(passwordChecks("")).toEqual([false, false, false, false])
    expect(passwordChecks("abcdefgh")).toEqual([true, false, false, false])
    expect(passwordChecks("Abcdefgh")).toEqual([true, true, false, false])
    expect(passwordChecks("Abcdefg1")).toEqual([true, true, true, false])
    expect(passwordChecks("Abcdef1!")).toEqual([true, true, true, true])
  })

  it("needs both cases for the second rule", () => {
    expect(passwordChecks("ABCDEFGH")[1]).toBe(false)
    expect(passwordChecks("abcdefgh")[1]).toBe(false)
  })

  it("does not count whitespace as a symbol", () => {
    expect(passwordChecks("Abcdef1 ")[3]).toBe(false)
  })
})

describe("loginSchema", () => {
  const ok = { email: "reader@example.com", password: "x", remember: true }

  it("accepts a valid email and any non-empty password", () => {
    expect(loginSchema.safeParse(ok).success).toBe(true)
  })

  it("asks for the email, and for a valid one", () => {
    expect(messages(loginSchema.safeParse({ ...ok, email: "" }))).toContain("emailRequired")
    expect(messages(loginSchema.safeParse({ ...ok, email: "   " }))).toContain("emailRequired")
    for (const bad of ["reader", "reader@", "@example.com", "reader@example", "re ader@example.com"]) {
      expect(messages(loginSchema.safeParse({ ...ok, email: bad })), bad).toContain("emailInvalid")
    }
  })

  it("asks for the password", () => {
    expect(messages(loginSchema.safeParse({ ...ok, password: "" }))).toContain("passwordRequired")
  })
})

describe("signupSchema", () => {
  const ok = {
    name: "Sokha",
    email: "sokha@example.com",
    password: "Abcdef1!",
    confirm: "Abcdef1!",
    ui: "en" as const,
    year: "1998",
    terms: true,
  }

  it("accepts a complete form", () => {
    expect(signupSchema.safeParse(ok).success).toBe(true)
  })

  it("needs a name of 2 to 20 characters after trimming", () => {
    expect(messages(signupSchema.safeParse({ ...ok, name: "A" }))).toContain("nameRequired")
    expect(messages(signupSchema.safeParse({ ...ok, name: "  A " }))).toContain("nameRequired")
    expect(messages(signupSchema.safeParse({ ...ok, name: "A".repeat(21) }))).toContain("nameRequired")
    expect(signupSchema.safeParse({ ...ok, name: "សុខា" }).success).toBe(true)
  })

  it("needs all 4 password rules", () => {
    for (const password of ["abcdefgh", "Abcdefgh", "Abcdefg1", "abcdefg1!"]) {
      expect(messages(signupSchema.safeParse({ ...ok, password, confirm: password }))).toContain("passwordRules")
    }
    expect(signupSchema.safeParse({ ...ok, password: "Abcdef1!", confirm: "Abcdef1!" }).success).toBe(true)
  })

  it("shows the mismatch together with the other errors", () => {
    const found = messages(signupSchema.safeParse({ ...ok, password: "weak", confirm: "other" }))
    expect(found).toContain("passwordRules")
    expect(found).toContain("mismatch")
  })

  it("needs a birth year and an age of at least 13", () => {
    expect(messages(signupSchema.safeParse({ ...ok, year: "" }))).toContain("yearRequired")
    expect(messages(signupSchema.safeParse({ ...ok, year: String(new Date().getFullYear()) }))).toContain("tooYoung")
  })

  it("needs the terms accepted", () => {
    expect(messages(signupSchema.safeParse({ ...ok, terms: false }))).toContain("termsRequired")
  })
})

describe("forgotSchema and newPasswordSchema", () => {
  it("forgot needs a valid email", () => {
    expect(forgotSchema.safeParse({ email: "a@b.co" }).success).toBe(true)
    expect(messages(forgotSchema.safeParse({ email: "" }))).toContain("emailRequired")
    expect(messages(forgotSchema.safeParse({ email: "nope" }))).toContain("emailInvalid")
  })

  it("a new password meets all 4 rules and is typed twice", () => {
    expect(newPasswordSchema.safeParse({ password: "Abcdef1!", confirm: "Abcdef1!" }).success).toBe(true)
    expect(messages(newPasswordSchema.safeParse({ password: "short", confirm: "short" }))).toContain("passwordRules")
    expect(messages(newPasswordSchema.safeParse({ password: "Abcdef1!", confirm: "Abcdef1?" }))).toContain("mismatch")
  })
})
