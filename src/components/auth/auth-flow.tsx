"use client"

import { CheckIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { authDraft, clearAuthDraft, type FlowState } from "@/components/auth/auth-draft"
import { CodeView } from "@/components/auth/code-view"
import { DoneView } from "@/components/auth/done-view"
import { ForgotView, SentView } from "@/components/auth/forgot-view"
import { LoginView } from "@/components/auth/login-view"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { SignupView } from "@/components/auth/signup-view"
import { AuthHead } from "@/components/auth/auth-ui"
import { setPasswordWithCode, type PendingCode } from "@/lib/session"
import { useAppStore, type StoredUser } from "@/lib/store"
import { cn } from "@/lib/utils"

type Mode = "signup" | "forgot" | "verify" | null

/** The `?mode=` that reopens a state (Log in has none). */
function modeOf(f: FlowState): Mode {
  if (f.view === "signup") return "signup"
  if (f.view === "code") return f.purpose === "signup" ? "verify" : "forgot"
  if (f.view === "forgot" || f.view === "sent" || f.view === "newpass") return "forgot"
  return null
}

const BASE: FlowState = {
  view: "login",
  purpose: "signup",
  pending: null,
  ui: null,
  resetEmail: "",
  resendAt: 0,
  flash: false,
  done: null,
}

/** `/login`, `?mode=signup`, `?mode=forgot`, `?mode=verify&email=` (the old /signup, /forgot, /verify redirect here). */
function flowFromUrl(params: URLSearchParams): FlowState {
  const mode = params.get("mode")
  const email = params.get("email")?.trim().toLowerCase() ?? ""
  const base = { ...BASE, flash: params.get("reset") === "done" }
  if (mode === "signup") return { ...base, view: "signup" }
  if (mode === "forgot") return { ...base, view: "forgot" }
  // Opened from an address (e.g. an email link): "Resend code" sends a new one right away.
  if (mode === "verify" && email) return { ...base, view: "code", purpose: "signup", pending: { email, resendAfterSeconds: 0 } }
  return base
}

/** Back from the language toggle (or a return visit in the same tab): continue the same step. */
function startFlow(params: URLSearchParams): FlowState {
  const fromUrl = flowFromUrl(params)
  const saved = authDraft.flow
  if (!saved || saved.view === "done" || modeOf(saved) !== modeOf(fromUrl)) return fromUrl
  if (fromUrl.view === "code" && saved.pending?.email !== fromUrl.pending?.email) return fromUrl
  return { ...saved, flash: saved.flash || fromUrl.flash }
}

/** The address follows the step, so a reload or the language switch lands on the same step. */
function writeUrl(f: FlowState) {
  const url = new URL(window.location.href)
  const mode = modeOf(f)
  if (mode) url.searchParams.set("mode", mode)
  else url.searchParams.delete("mode")
  if (mode === "verify" && f.pending) url.searchParams.set("email", f.pending.email)
  else url.searchParams.delete("email")
  url.searchParams.delete("reset")
  if (url.href !== window.location.href) window.history.replaceState(null, "", url)
}

const secondsFromNow = (s: number) => Date.now() + s * 1000

/**
 * The V2.1 /login card (spec §5): Log in ↔ Sign up tabs, Sign up → 6-digit code, Forgot → code → new password
 * (demo; the real API emails a /reset link instead) → Log in with a success message, and the Done step
 * ("Welcome back, Sokha · Taking you back to …"). New accounts continue to /welcome.
 */
export function AuthFlow() {
  const t = useTranslations("auth")
  const params = useSearchParams()
  const [flow, setFlow] = useState(() => startFlow(params))

  // The header's Log in / Sign up links change ?mode on this page: follow them.
  const urlMode = params.get("mode")
  const [seenMode, setSeenMode] = useState(urlMode)
  if (urlMode !== seenMode) {
    setSeenMode(urlMode)
    if (flow.view !== "done" && urlMode !== modeOf(flow)) setFlow(flowFromUrl(params))
  }

  // Next.js keeps a page that was left alive but hidden (Cache Components / Activity) and shows it again on the
  // next visit: a finished log in must not come back as "Welcome back…", which would send the reader away again.
  useEffect(() => () => setFlow((f) => (f.view === "done" ? BASE : f)), [])

  useEffect(() => {
    authDraft.flow = flow
    // Tidy the address: `?reset=done` is read once, and `?mode=verify` without an email opens Log in.
    if (flow.view !== "done") writeUrl(flow)
  }, [flow])

  function go(patch: Partial<FlowState>) {
    const next: FlowState = { ...flow, flash: false, ...patch }
    setFlow(next)
    if (next.view !== "done") writeUrl(next)
  }

  function finish(user: StoredUser, isNew: boolean) {
    const store = useAppStore.getState()
    store.login(user)
    if (isNew) {
      // First-time setup, then back to where the reader was.
      store.setWelcomeNext(store.returnTo ?? "/")
      if (flow.ui) store.setLang(flow.ui)
    }
    clearAuthDraft()
    setFlow({ ...flow, view: "done", flash: false, done: { name: user.name, isNew } })
  }

  const toCode = (purpose: FlowState["purpose"], pending: PendingCode | null, patch: Partial<FlowState> = {}) =>
    go({ view: "code", purpose, pending, resendAt: secondsFromNow(pending?.resendAfterSeconds ?? 30), ...patch })

  const tabbed = flow.view === "login" || flow.view === "signup"

  return (
    <>
      {tabbed ? (
        <ModeTabs
          value={flow.view as "login" | "signup"}
          onChange={(v) => {
            // The prototype carries the typed email over to Sign up.
            if (v === "signup" && authDraft.login?.email && !authDraft.signup?.email) {
              authDraft.signup = { ...authDraft.signup, email: authDraft.login.email }
            }
            go({ view: v })
          }}
        />
      ) : null}

      {flow.flash && flow.view === "login" ? (
        <div role="status" className="flex items-start gap-3 rounded-[10px] border border-brand-soft-border bg-brand-soft px-4 py-3.5">
          <CheckIcon className="mt-px size-4 shrink-0 text-brand-ink" aria-hidden />
          <span className="text-[13px] leading-[19px] font-medium text-brand-ink">{t("flashReset")}</span>
        </div>
      ) : null}

      {flow.view === "login" ? (
        <LoginView
          onForgot={(email) => {
            if (email) authDraft.forgotEmail = email
            go({ view: "forgot" })
          }}
          onSignup={() => go({ view: "signup" })}
          onDone={(user) => finish(user, false)}
          onNeedsCode={(email) => toCode("signup", { email, resendAfterSeconds: 30 })}
        />
      ) : null}

      {flow.view === "signup" ? (
        <SignupView
          onLogin={(email) => {
            if (email) authDraft.login = { ...authDraft.login, email }
            go({ view: "login" })
          }}
          onSubmitted={(pending, ui) => toCode("signup", pending, { ui })}
        />
      ) : null}

      {flow.view === "forgot" ? (
        <ForgotView
          onBack={() => go({ view: "login" })}
          onSent={(email, withCode) =>
            withCode ? toCode("reset", null, { resetEmail: email }) : go({ view: "sent", resetEmail: email })
          }
        />
      ) : null}

      {flow.view === "sent" ? <SentView email={flow.resetEmail} onBack={() => go({ view: "login" })} /> : null}

      {flow.view === "code" ? (
        <CodeView
          key={`${flow.purpose}:${flow.pending?.email ?? flow.resetEmail}`}
          purpose={flow.purpose}
          email={flow.purpose === "signup" ? (flow.pending?.email ?? "") : flow.resetEmail}
          pending={flow.pending}
          resendAt={flow.resendAt}
          onResent={(seconds) => go({ resendAt: secondsFromNow(seconds) })}
          onBack={() => go({ view: flow.purpose === "signup" ? "signup" : "forgot" })}
          onVerified={(user) => finish(user, true)}
          onResetCodeOk={() => go({ view: "newpass" })}
        />
      ) : null}

      {flow.view === "newpass" ? (
        <div className="flex flex-col gap-[18px]">
          <AuthHead
            title={t("resetTitle")}
            sub={t.rich("newPassFor", {
              email: flow.resetEmail,
              b: (chunks) => <strong className="font-semibold break-all text-foreground">{chunks}</strong>,
            })}
          />
          <NewPasswordForm
            save={(password) => setPasswordWithCode(flow.resetEmail, password)}
            onSaved={() => {
              authDraft.login = { remember: true, email: flow.resetEmail }
              go({ view: "login", flash: true })
            }}
          />
        </div>
      ) : null}

      {flow.view === "done" && flow.done ? <DoneView name={flow.done.name} isNew={flow.done.isNew} ui={flow.ui} /> : null}
    </>
  )
}

/** `.au-tabs`: Log in / Sign up as two tabs on a muted track (arrow keys move between them). */
function ModeTabs({ value, onChange }: { value: "login" | "signup"; onChange: (v: "login" | "signup") => void }) {
  const t = useTranslations("auth")
  const tabs = ["login", "signup"] as const
  return (
    <div role="tablist" aria-label={t("modes")} className="grid grid-cols-2 gap-0.5 rounded-xl bg-muted p-1">
      {tabs.map((id) => (
        <button
          key={id}
          id={`auth-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={value === id}
          tabIndex={value === id ? 0 : -1}
          onClick={() => onChange(id)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
            e.preventDefault()
            const next = e.key === "Home" ? "login" : e.key === "End" ? "signup" : id === "login" ? "signup" : "login"
            onChange(next)
            document.getElementById(`auth-tab-${next}`)?.focus()
          }}
          className={cn(
            "h-[38px] rounded-[9px] text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            value === id ? "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(id)}
        </button>
      ))}
    </div>
  )
}
