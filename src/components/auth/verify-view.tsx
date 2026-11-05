"use client"

import { useMutation } from "@tanstack/react-query"
import { ArrowLeftIcon, MailIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { SignupData } from "@/components/auth/signup-view"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { demoData } from "@/data"
import { DemoApiError, verifyCode } from "@/lib/demo-api"
import { useAppStore } from "@/lib/store"

const RESEND_SECONDS = 30

/** Verify email: 6-digit code, resend countdown, demo code hint. A right code creates the account and logs in. */
export function VerifyView({
  data,
  onBack,
  onDone,
}: {
  data: SignupData
  onBack: () => void
  onDone: () => void
}) {
  const t = useTranslations("auth")
  const tt = useTranslations("toasts")
  const [code, setCode] = useState("")
  const [seconds, setSeconds] = useState(RESEND_SECONDS)
  const otpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  const verify = useMutation({
    mutationFn: () => verifyCode(code),
    onSuccess: () => {
      const store = useAppStore.getState()
      store.addAccount({ name: data.name, email: data.email, password: data.password })
      store.login({ name: data.name, email: data.email })
      onDone()
    },
    // Keep the typed code (shown red) and the focus in the OTP so the reader can edit it.
    onError: () => requestAnimationFrame(() => otpRef.current?.focus()),
  })

  const wrong = verify.error instanceof DemoApiError && verify.error.code === "invalid_code"

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
          {t("verifySub")} <span className="font-medium text-foreground">{data.email}</span>
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
          aria-describedby={wrong ? "otp-error" : undefined}
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
        {wrong ? (
          <p id="otp-error" role="alert" className="text-[13px] text-destructive">
            {t("wrongCode")}
          </p>
        ) : null}
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
            onClick={() => {
              setSeconds(RESEND_SECONDS)
              toast.success(tt("codeSent"))
            }}
          >
            {t("resend")}
          </button>
        )}
      </p>
      <p className="type-small font-normal text-muted-foreground">
        {t("demoCode", { code: demoData.demoAccount.verificationCode })}
      </p>

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
