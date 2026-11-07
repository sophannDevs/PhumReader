"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { DoneView } from "@/components/auth/done-view"
import { ForgotView } from "@/components/auth/forgot-view"
import { LoginView } from "@/components/auth/login-view"
import { VerifyView } from "@/components/auth/verify-view"
import { SignupView } from "@/components/auth/signup-view"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PendingCode } from "@/lib/session"

type View = "login" | "signup" | "verify" | "forgot" | "done"

/** The addressable pages: each view that can be opened by URL has its own route. */
export type StartView = "login" | "signup" | "verify" | "forgot"

const PAGE_OF: Record<StartView, string> = { login: "login", signup: "signup", verify: "verify", forgot: "forgot" }

/**
 * The whole /login page as one small state machine: Log in <-> Sign up -> Verify,
 * Forgot password -> Sent, and Done. `/login`, `/signup`, `/forgot` and `/verify?email=` open on their own
 * view (the address follows the view); the older `/login?mode=signup` still works.
 */
export function AuthFlow({ initial = "login" }: { initial?: StartView }) {
  const t = useTranslations("auth")
  const params = useSearchParams()
  const mode = params.get("mode")
  // /verify opened by address: the email comes from ?email= (a new code is sent from the Resend button).
  const emailParam = params.get("email")?.trim().toLowerCase() ?? ""
  const startView: View =
    initial === "verify" && !emailParam
      ? "login"
      : initial !== "login"
        ? initial
        : mode === "signup" || mode === "forgot"
          ? mode
          : "login"
  const [view, setViewState] = useState<View>(startView)
  // The email waiting for its code: after Sign up (T34), or after logging in with an unconfirmed email.
  const [pending, setPending] = useState<PendingCode | null>(
    startView === "verify" ? { email: emailParam, resendAfterSeconds: 0 } : null,
  )
  const [verifyFrom, setVerifyFrom] = useState<"signup" | "login">(initial === "verify" ? "login" : "signup")

  // The address follows the view (/login, /signup, /forgot, /verify?email=) so a reload or the language
  // switch (which opens the other locale's route) lands on the same view. Done is not persisted.
  function setView(next: View, email?: string) {
    setViewState(next)
    if (next === "done") return
    const url = new URL(window.location.href)
    url.pathname = url.pathname.replace(/\/(login|signup|forgot|verify)\/?$/, `/${PAGE_OF[next]}`)
    url.searchParams.delete("mode")
    if (next === "verify" && email) url.searchParams.set("email", email)
    else url.searchParams.delete("email")
    window.history.replaceState(null, "", url)
  }

  if (view === "done") return <DoneView />

  const tabbed = view === "login" || view === "signup"

  return (
    <div className="flex flex-col gap-5">
      {tabbed ? (
        <>
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="type-h2">{t(view === "login" ? "loginTitle" : "signupTitle")}</h1>
            <p className="type-body text-muted-foreground">{t(view === "login" ? "loginSub" : "signupSub")}</p>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList className="w-full" aria-label={t("modes")}>
              <TabsTrigger value="login" aria-controls={undefined}>{t("login")}</TabsTrigger>
              <TabsTrigger value="signup" aria-controls={undefined}>{t("signup")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </>
      ) : null}

      {view === "login" ? (
        <LoginView
          onForgot={() => setView("forgot")}
          onDone={() => setView("done")}
          onNeedsCode={(next) => {
            setPending(next)
            setVerifyFrom("login")
            setView("verify", next.email)
          }}
        />
      ) : null}
      {view === "signup" ? (
        <SignupView
          onSubmitted={(next) => {
            setPending(next)
            setVerifyFrom("signup")
            setView("verify", next.email)
          }}
        />
      ) : null}
      {view === "verify" && pending ? (
        <VerifyView pending={pending} onBack={() => setView(verifyFrom)} onDone={() => setView("done")} />
      ) : null}
      {view === "forgot" ? <ForgotView onBack={() => setView("login")} /> : null}
    </div>
  )
}
