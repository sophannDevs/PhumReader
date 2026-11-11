"use client"

import { demoData } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import { ApiError, api, type Schemas } from "@/lib/api/client"
import { useAppStore, type StoredUser } from "@/lib/store"

/**
 * Sign-in for both modes. With the real API the session lives in HttpOnly cookies and the store
 * only keeps the name and email for the header; in demo mode everything stays in the store.
 */

type Me = Schemas["MeResponse"]

export const toUser = (me: Me): StoredUser => ({ name: me.displayName, email: me.email, roles: me.roles, avatarUrl: me.avatarUrl ?? null })

export type SignupData = { name: string; email: string; password: string }

/** A sign-up (or an unconfirmed log in) waiting for its email code. */
export type PendingCode = {
  email: string
  /** Set after Sign up; the demo needs it to create the local account. */
  signup?: SignupData
  /** When "Resend code" may be used. */
  resendAfterSeconds: number
}

const RESEND_SECONDS = 30

/** The signed-in account, or null (the API's silent refresh runs first). Real API only. */
export async function currentUser(): Promise<StoredUser | null> {
  try {
    return toUser(await api.get<Me>("/me"))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function logIn(email: string, password: string, remember: boolean): Promise<StoredUser> {
  if (DEMO_MODE) {
    const demo = await import("@/lib/demo-api")
    return demo.login(email, password, useAppStore.getState().accounts)
  }
  return toUser(await api.post<Me>("/auth/login", { email: email.trim(), password, remember }))
}

export type SocialProvider = "google" | "facebook" | "apple"

/** The API has no Apple sign-in yet: real mode shows "coming soon" for it. The demo simulates all three. */
export const socialReady = (provider: SocialProvider) => DEMO_MODE || provider !== "apple"

/**
 * Google / Facebook / Apple: simulated in the demo. With the real API the whole page goes to the provider
 * (through the API's `start` endpoint) and comes back to `/login?social=<result>`, so this promise
 * never settles: the page is being left. Check `socialReady` first (Apple rejects in real mode).
 */
export function socialLogIn(provider: SocialProvider, locale: string): Promise<StoredUser> {
  if (DEMO_MODE) return import("@/lib/demo-api").then((demo) => demo.socialLogin(provider))
  if (provider === "apple") return Promise.reject(new Error("Apple sign-in is not available yet"))
  // A full page navigation to the API (not a Next.js page), so the lint rule for internal pages does not apply.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/api/v1/auth/oauth/${provider}/start?locale=${locale === "km" ? "km" : "en"}`
  return new Promise<StoredUser>(() => undefined)
}

/** Creates the account (real API) and emails the code. */
export async function signUp(data: SignupData, language: string): Promise<PendingCode> {
  if (DEMO_MODE) {
    const demo = await import("@/lib/demo-api")
    await demo.signUp(data, useAppStore.getState().accounts.map((a) => a.email))
    return { email: data.email, signup: data, resendAfterSeconds: RESEND_SECONDS }
  }
  const sent = await api.post<Schemas["SignupResponse"]>("/auth/signup", { ...data, language })
  return { email: sent.email, signup: data, resendAfterSeconds: sent.resendAfterSeconds }
}

/** The right code confirms the email and signs in. */
export async function verifyEmail(pending: PendingCode, code: string): Promise<StoredUser> {
  if (DEMO_MODE) {
    const demo = await import("@/lib/demo-api")
    await demo.verifyCode(code)
    const signup = pending.signup ?? { name: pending.email, email: pending.email, password: "" }
    useAppStore.getState().addAccount(signup)
    return { name: signup.name, email: signup.email }
  }
  return toUser(await api.post<Me>("/auth/verify", { email: pending.email, code }))
}

export async function resendCode(email: string): Promise<void> {
  if (DEMO_MODE) return
  await api.post("/auth/resend-code", { email })
}

/** Emails a reset link; resolves with the address it was sent to. */
export async function requestPasswordReset(email: string): Promise<string> {
  if (DEMO_MODE) {
    const demo = await import("@/lib/demo-api")
    return (await demo.sendResetLink(email)).email
  }
  await api.post("/auth/forgot-password", { email: email.trim() })
  return email.trim()
}

/**
 * How "Forgot password" works: the demo emails a 6-digit code and sets the new password on the same page
 * (V2.1 design, spec §5); the real API emails a link to `/reset?token=…` (plan P4-09).
 */
export const RESET_WITH_CODE = DEMO_MODE

/** Demo only: checks the 6-digit reset code (demoData.emailCode). */
export async function checkResetCode(code: string): Promise<void> {
  await (await import("@/lib/demo-api")).verifyCode(code)
}

const DEMO_ROLES: Record<string, string[]> = {
  reader: ["READER"],
  creator: ["READER", "CREATOR"],
  moderator: ["READER", "CREATOR", "ADMIN"],
}

/**
 * Demo only: the new password from the code flow, saved with this device's demo accounts (name and roles kept).
 * The demo accounts' original passwords keep working too (demoData is read-only).
 */
export async function setPasswordWithCode(email: string, password: string): Promise<void> {
  await (await import("@/lib/demo-api")).withDemo(() => undefined)
  const e = email.trim().toLowerCase()
  const store = useAppStore.getState()
  const own = store.accounts.find((a) => a.email.toLowerCase() === e)
  const preset = demoData.demoAccounts.find((a) => a.email.toLowerCase() === e)
  store.addAccount({
    name: own?.name ?? preset?.name ?? e.split("@")[0],
    email: own?.email ?? e,
    password,
    roles: own?.roles ?? (preset ? DEMO_ROLES[preset.role] : ["READER"]),
  })
}

/** Sets a new password from a reset link (and signs out every device). */
export async function resetPassword(token: string, password: string): Promise<void> {
  if (DEMO_MODE) {
    // The demo sends no emails, so any link "works".
    const demo = await import("@/lib/demo-api")
    await demo.withDemo(() => undefined)
    return
  }
  await api.post("/auth/reset-password", { token, password })
}

/** Logs this device out. The local state is cleared even when the API cannot be reached. */
export async function logOut(): Promise<void> {
  if (!DEMO_MODE) await api.post("/auth/logout").catch(() => undefined)
  useAppStore.getState().logout()
}
