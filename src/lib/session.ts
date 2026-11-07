"use client"

import { DEMO_MODE } from "@/lib/api/config"
import { ApiError, api, type Schemas } from "@/lib/api/client"
import * as demo from "@/lib/demo-api"
import { useAppStore, type StoredUser } from "@/lib/store"

/**
 * Sign-in for both modes. With the real API the session lives in HttpOnly cookies and the store
 * only keeps the name and email for the header; in demo mode everything stays in the store.
 */

type Me = Schemas["MeResponse"]

const toUser = (me: Me): StoredUser => ({ name: me.displayName, email: me.email, roles: me.roles })

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
  if (DEMO_MODE) return demo.login(email, password, useAppStore.getState().accounts)
  return toUser(await api.post<Me>("/auth/login", { email: email.trim(), password, remember }))
}

/**
 * Google / Facebook: simulated in the demo. With the real API the whole page goes to the provider
 * (through the API's `start` endpoint) and comes back to `/login?social=<result>`, so this promise
 * never settles: the page is being left.
 */
export function socialLogIn(provider: "google" | "facebook", locale: string): Promise<StoredUser> {
  if (DEMO_MODE) return demo.socialLogin(provider)
  window.location.assign(`/api/v1/auth/oauth/${provider}/start?locale=${locale === "km" ? "km" : "en"}`)
  return new Promise<StoredUser>(() => undefined)
}

/** Creates the account (real API) and emails the code. */
export async function signUp(data: SignupData, language: string): Promise<PendingCode> {
  if (DEMO_MODE) {
    await demo.signUp(data, useAppStore.getState().accounts.map((a) => a.email))
    return { email: data.email, signup: data, resendAfterSeconds: RESEND_SECONDS }
  }
  const sent = await api.post<Schemas["SignupResponse"]>("/auth/signup", { ...data, language })
  return { email: sent.email, signup: data, resendAfterSeconds: sent.resendAfterSeconds }
}

/** The right code confirms the email and signs in. */
export async function verifyEmail(pending: PendingCode, code: string): Promise<StoredUser> {
  if (DEMO_MODE) {
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
  if (DEMO_MODE) return (await demo.sendResetLink(email)).email
  await api.post("/auth/forgot-password", { email: email.trim() })
  return email.trim()
}

/** Sets a new password from a reset link (and signs out every device). */
export async function resetPassword(token: string, password: string): Promise<void> {
  if (DEMO_MODE) {
    // The demo sends no emails, so any link "works".
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
