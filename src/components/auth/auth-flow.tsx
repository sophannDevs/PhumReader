"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { DoneView } from "@/components/auth/done-view"
import { ForgotView } from "@/components/auth/forgot-view"
import { LoginView } from "@/components/auth/login-view"
import { VerifyView } from "@/components/auth/verify-view"
import { SignupView, type SignupData } from "@/components/auth/signup-view"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type View = "login" | "signup" | "verify" | "forgot" | "done"

/**
 * The whole /login page as one small state machine: Log in <-> Sign up -> Verify,
 * Forgot password -> Sent, and Done. `?mode=signup` opens on Sign up.
 */
export function AuthFlow() {
  const t = useTranslations("auth")
  const params = useSearchParams()
  const mode = params.get("mode")
  const [view, setViewState] = useState<View>(mode === "signup" ? "signup" : mode === "forgot" ? "forgot" : "login")
  // The sign-up details held while the reader verifies the email code (T34).
  const [pending, setPending] = useState<SignupData | null>(null)

  // Log in / Sign up / Forgot are kept in `?mode=` so the language switch (which opens the
  // other locale's route) lands on the same view. Verify and Done are not persisted.
  function setView(next: View) {
    setViewState(next)
    const url = new URL(window.location.href)
    if (next === "signup" || next === "forgot") url.searchParams.set("mode", next)
    else url.searchParams.delete("mode")
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
              <TabsTrigger value="login">{t("login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </>
      ) : null}

      {view === "login" ? <LoginView onForgot={() => setView("forgot")} onDone={() => setView("done")} /> : null}
      {view === "signup" ? (
        <SignupView
          onSubmitted={(data) => {
            setPending(data)
            setView("verify")
          }}
        />
      ) : null}
      {view === "verify" && pending ? (
        <VerifyView data={pending} onBack={() => setView("signup")} onDone={() => setView("done")} />
      ) : null}
      {view === "forgot" ? <ForgotView onBack={() => setView("login")} /> : null}
    </div>
  )
}
