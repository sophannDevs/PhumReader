import { describe, expect, it } from "vitest"
import { forgotSchema, loginSchema, passwordChecks, resetSchema, signupSchema } from "./auth-schemas"

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
  const ok = { name: "Sokha", email: "sokha@example.com", password: "Abcdef1!", terms: true }

  it("accepts a complete form", () => {
    expect(signupSchema.safeParse(ok).success).toBe(true)
  })

  it("needs a name of at least 2 characters after trimming", () => {
    expect(messages(signupSchema.safeParse({ ...ok, name: "A" }))).toContain("nameRequired")
    expect(messages(signupSchema.safeParse({ ...ok, name: "  A " }))).toContain("nameRequired")
    expect(signupSchema.safeParse({ ...ok, name: "សុខា" }).success).toBe(true)
  })

  it("needs at least 3 of the 4 password rules", () => {
    expect(messages(signupSchema.safeParse({ ...ok, password: "abcdefgh" }))).toContain("passwordWeak")
    expect(messages(signupSchema.safeParse({ ...ok, password: "Abcdefgh" }))).toContain("passwordWeak")
    expect(signupSchema.safeParse({ ...ok, password: "Abcdefg1" }).success).toBe(true)
    // 3 rules are enough in any combination: length + digit + symbol, without capitals
    expect(signupSchema.safeParse({ ...ok, password: "abcdefg1!" }).success).toBe(true)
    // only 2 rules: length + digit, or digit + symbol on a short password
    expect(messages(signupSchema.safeParse({ ...ok, password: "abcdefg1" }))).toContain("passwordWeak")
    expect(messages(signupSchema.safeParse({ ...ok, password: "abc1!" }))).toContain("passwordWeak")
  })

  it("needs the terms accepted", () => {
    expect(messages(signupSchema.safeParse({ ...ok, terms: false }))).toContain("termsRequired")
  })
})

describe("forgotSchema and resetSchema", () => {
  it("forgot needs a valid email", () => {
    expect(forgotSchema.safeParse({ email: "a@b.co" }).success).toBe(true)
    expect(messages(forgotSchema.safeParse({ email: "" }))).toContain("emailRequired")
    expect(messages(forgotSchema.safeParse({ email: "nope" }))).toContain("emailInvalid")
  })

  it("reset needs a password that passes 3 of the 4 rules", () => {
    expect(resetSchema.safeParse({ password: "Abcdef1!" }).success).toBe(true)
    expect(messages(resetSchema.safeParse({ password: "short" }))).toContain("passwordWeak")
  })
})
