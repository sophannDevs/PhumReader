"use client"

import { useMutation } from "@tanstack/react-query"
import { ArrowLeftIcon, MailIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { DEMO_MODE } from "@/lib/api/config"
import { errorCode, retryAfterSeconds } from "@/lib/api/errors"
import { resendCode, verifyEmail, type PendingCode } from "@/lib/session"
import { useAppStore } from "@/lib/store"
import { useWaitText } from "@/lib/use-wait-text"

/** Verify email: 6-digit code, resend countdown, demo code hint. A right code confirms the account and logs in. */
export function VerifyView({
  pending,
  onBack,
  onDone,
}: {
  pending: PendingCode
  onBack: () => void
  onDone: () => void
}) {
  const t = useTranslations("auth")
  const tt = useTranslations("toasts")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  const [code, setCode] = useState("")
  const [seconds, setSeconds] = useState(pending.resendAfterSeconds)
  const otpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  const verify = useMutation({
    mutationFn: () => verifyEmail(pending, code),
    onSuccess: (user) => {
      useAppStore.getState().login(user)
      onDone()
    },
    // Keep the typed code (shown red) and the focus in the OTP so the reader can edit it.
    onError: (e) => {
      const messages: Record<string, string> = {
        invalid_code: t("wrongCode"),
        code_expired: t("codeExpired"),
        too_many_attempts: t("codeTooMany"),
        already_verified: t("alreadyVerified"),
      }
      toast.error(messages[errorCode(e) ?? ""] ?? ts("errorTitle"), { duration: 5000 })
      requestAnimationFrame(() => otpRef.current?.focus())
    },
  })

  const resend = useMutation({
    mutationFn: () => resendCode(pending.email),
    onSuccess: () => {
      setSeconds(30)
      toast.success(tt("codeSent"))
    },
    onError: (e) => {
      const wait = retryAfterSeconds(e)
      if (wait !== undefined) {
        setSeconds(wait)
        toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      } else {
        toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
      }
    },
  })

  const wrong = ["invalid_code", "code_expired", "too_many_attempts"].includes(errorCode(verify.error) ?? "")

  return (
    <form
      className="flex flex-col items-center gap-5 text-center"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.length === 6) verify.mutate()
      }}
    >
      <span className="flex size-12 items-center justify-center rounded-card bg-muted text-muted-foreground">
        <MailIcon className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="type-h2">{t("verifyTitle")}</h1>
        <p className="type-body text-muted-foreground">
          {t("verifySub")} <span className="font-medium text-foreground">{pending.email}</span>
        </p>
      </div>

      <div data-invalid={wrong || undefined} className="flex flex-col items-center gap-2">
        <InputOTP
          ref={otpRef}
          maxLength={6}
          value={code}
          autoFocus
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={t("codeLabel")}
          aria-invalid={wrong}
          onChange={(v) => {
            setCode(v)
            if (verify.isError) verify.reset()
          }}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button type="submit" variant="brand" size="lg" className="w-full" loading={verify.isPending} disabled={code.length < 6}>
        {t("verify")}
      </Button>

      <p className="type-small font-normal text-muted-foreground" aria-live="polite">
        {t("noCode")}{" "}
        {seconds > 0 ? (
          <span className="tabular-nums">{t("resendIn", { seconds })}</span>
        ) : (
          <button
            type="button"
            className="rounded-sm font-medium text-brand-ink underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
          >
            {t("resend")}
          </button>
        )}
      </p>
      {DEMO_MODE ? (
        <p className="type-small font-normal text-muted-foreground">
          {t("demoCode", { code: "123456" })}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t("changeEmail")}
      </button>
    </form>
  )
}
