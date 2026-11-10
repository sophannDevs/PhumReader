import type { Locale } from "@/i18n/routing"
import type { PendingCode } from "@/lib/session"

export type AuthView = "login" | "signup" | "forgot" | "sent" | "code" | "newpass" | "done"

/** The /login card as one small state machine (auth-flow.tsx). */
export type FlowState = {
  view: AuthView
  /** What the 6-digit code is for: confirming a new account, or a password reset (demo). */
  purpose: "signup" | "reset"
  /** The account waiting for its code (sign up, or a log in with an unconfirmed email). */
  pending: PendingCode | null
  /** Sign up's "App language": the new account continues in it. */
  ui: Locale | null
  /** Forgot password: the account's email. */
  resetEmail: string
  /** Epoch ms from which "Resend code" may be used. */
  resendAt: number
  /** "Password updated. Log in with your new password." above Log in. */
  flash: boolean
  done: { name: string; isNew: boolean } | null
}

/**
 * What the card holds, kept outside React while the tab is open: the language toggle loads the other
 * locale's page (a new React tree), and the step, the typed email / name / choices and a waiting code survive
 * it. Typed passwords are not kept. Cleared after a successful log in or sign up.
 */
export const authDraft: {
  flow?: FlowState
  login?: { email?: string; remember?: boolean }
  signup?: { name?: string; email?: string; ui?: Locale; year?: string; terms?: boolean }
  forgotEmail?: string
} = {}

export function clearAuthDraft() {
  delete authDraft.flow
  delete authDraft.login
  delete authDraft.signup
  delete authDraft.forgotEmail
}
