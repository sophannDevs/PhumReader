"use client"

import { useMutation } from "@tanstack/react-query"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { MailIcon } from "@/components/animate-ui/icons/mail"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AuthHead, AuthNote, authLink, BackButton, FieldError, SubmitButton } from "@/components/auth/auth-ui"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { demoData } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import { errorCode, retryAfterSeconds } from "@/lib/api/errors"
import { checkResetCode, requestPasswordReset, resendCode, verifyEmail, type PendingCode } from "@/lib/session"
import type { StoredUser } from "@/lib/store"
import { useWaitText } from "@/lib/use-wait-text"

const RESEND_SECONDS = 30
const secondsUntil = (at: number) => Math.max(0, Math.ceil((at - Date.now()) / 1000))

/**
 * The 6-digit code step (`isCode` in the prototype): "Verify your email" after Sign up (a right code confirms
 * the account and logs in), or "Enter your reset code" in the demo's Forgot password. Resend after 30 s.
 */
export function CodeView({
  purpose,
  email,
  pending,
  resendAt,
  onResent,
  onBack,
  onVerified,
  onResetCodeOk,
}: {
  purpose: "signup" | "reset"
  email: string
  pending: PendingCode | null
  /** Epoch ms from which "Resend code" may be used. */
  resendAt: number
  onResent: (seconds: number) => void
  onBack: () => void
  onVerified: (user: StoredUser) => void
  onResetCodeOk: () => void
}) {
  const t = useTranslations("auth")
  const tt = useTranslations("toasts")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(() => secondsUntil(resendAt))
  const otpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds(secondsUntil(resendAt)), 1000)
    return () => clearTimeout(id)
  }, [seconds, resendAt])

  const verify = useMutation({
    mutationFn: async (): Promise<StoredUser | null> => {
      if (purpose === "signup") return verifyEmail(pending ?? { email, resendAfterSeconds: 0 }, code)
      await checkResetCode(code)
      return null
    },
    onSuccess: (user) => (user ? onVerified(user) : onResetCodeOk()),
    // Keep the typed code (shown red) and the focus in the code field so it can be edited.
    onError: (e) => {
      const messages: Record<string, string> = {
        invalid_code: t("wrongCode"),
        code_expired: t("codeExpired"),
        too_many_attempts: t("codeTooMany"),
        already_verified: t("alreadyVerified"),
      }
      setError(messages[errorCode(e) ?? ""] ?? ts("errorTitle"))
      requestAnimationFrame(() => otpRef.current?.focus())
    },
  })

  const resend = useMutation({
    mutationFn: () => (purpose === "signup" ? resendCode(email) : requestPasswordReset(email).then(() => undefined)),
    onSuccess: () => {
      setSeconds(RESEND_SECONDS)
      onResent(RESEND_SECONDS)
      setCode("")
      setError(null)
      toast.success(tt("codeSent"))
    },
    onError: (e) => {
      const wait = retryAfterSeconds(e)
      if (wait !== undefined) {
        setSeconds(wait)
        onResent(wait)
        toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      } else {
        toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
      }
    },
  })

  return (
    <div className="flex flex-col gap-[18px]">
      <BackButton onClick={onBack}>{t("changeEmail")}</BackButton>
      <AuthHead
        icon={<MailIcon className="size-5" />}
        title={purpose === "signup" ? t("verifyTitle") : t("resetCodeTitle")}
        sub={
          <>
            {t("verifySub")} <strong className="font-semibold break-all text-foreground">{email}</strong>
          </>
        }
      />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length < 6) {
            setError(t("codeShort"))
            otpRef.current?.focus()
            return
          }
          verify.mutate()
        }}
      >
        <span id="code-label" className="-mb-2 text-sm leading-5 font-medium">
          {t("codeLabel6")}
        </span>
        <div data-invalid={!!error || undefined}>
          <InputOTP
            ref={otpRef}
            maxLength={6}
            value={code}
            autoFocus
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-labelledby="code-label"
            aria-invalid={!!error}
            aria-describedby={error ? "code-error" : undefined}
            containerClassName="w-full"
            onChange={(v) => {
              setCode(v)
              if (error) setError(null)
              if (verify.isError) verify.reset()
            }}
          >
            <InputOTPGroup className="grid w-full grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-[50px] w-full rounded-[10px] text-[22px] md:h-14 md:w-full data-[active=true]:border-border-strong data-[active=true]:ring-[3px] data-[active=true]:ring-ring/25 data-[active=true]:ring-offset-0"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {error ? (
          <FieldError id="code-error">
            <span role="alert">{error}</span>
          </FieldError>
        ) : null}
        <SubmitButton loading={verify.isPending}>{purpose === "signup" ? t("verify") : t("resetContinue")}</SubmitButton>
      </form>

      <p className="flex flex-wrap items-center justify-center gap-1.5 text-[13px] leading-[18px]">
        <span className="text-muted-foreground">{t("noCode")}</span>
        <button type="button" className={authLink} disabled={seconds > 0 || resend.isPending} onClick={() => resend.mutate()}>
          {seconds > 0 ? <span className="tabular-nums">{t("resendIn", { seconds })}</span> : t("resend")}
        </button>
      </p>

      <AuthNote>{DEMO_MODE ? `${t("spam")} · ${t("demoCode", { code: demoData.emailCode })}` : t("spam")}</AuthNote>
    </div>
  )
}
