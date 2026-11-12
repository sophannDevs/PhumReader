"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { MailCheckIcon } from "@/components/animate-ui/icons/mail-check"
import { useTranslations } from "@/i18n/translations"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { authDraft } from "@/components/auth/auth-draft"
import { forgotSchema, type ForgotValues } from "@/components/auth/auth-schemas"
import { AuthHead, authInput, AuthNote, BackButton, FieldError, SubmitButton } from "@/components/auth/auth-ui"
import { Input } from "@/components/ui/input"
import { retryAfterSeconds } from "@/lib/api/errors"
import { requestPasswordReset, RESET_WITH_CODE } from "@/lib/session"
import { useWaitText } from "@/lib/use-wait-text"

/** Forgot password: email → "Send code" (demo: a 6-digit code) or "Send reset link" (real API: an emailed link). */
export function ForgotView({ onBack, onSent }: { onBack: () => void; onSent: (email: string, withCode: boolean) => void }) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: authDraft.forgotEmail ?? "" } })
  const { errors } = form.formState
  const email = useWatch({ control: form.control, name: "email" })
  useEffect(() => {
    authDraft.forgotEmail = email
  }, [email])

  const send = useMutation({
    mutationFn: (v: ForgotValues) => requestPasswordReset(v.email),
    onSuccess: (sentTo) => onSent(sentTo.trim().toLowerCase(), RESET_WITH_CODE),
    onError: (e) => {
      const wait = retryAfterSeconds(e)
      if (wait !== undefined) toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
    },
  })

  return (
    <div className="flex flex-col gap-[18px]">
      <BackButton onClick={onBack}>{t("backLogin")}</BackButton>
      <AuthHead title={t("forgotTitle")} sub={RESET_WITH_CODE ? t("forgotSubCode") : t("forgotSub")} />
      <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => send.mutate(v))}>
        <div className="flex flex-col gap-2">
          <label htmlFor="forgot-email" className="text-sm leading-5 font-medium">
            {t("email")}
          </label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            className={authInput}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "forgot-email-error" : undefined}
            {...form.register("email")}
          />
          {errors.email ? <FieldError id="forgot-email-error">{t(errors.email.message as "emailRequired")}</FieldError> : null}
        </div>
        <SubmitButton loading={send.isPending}>{RESET_WITH_CODE ? t("sendCode") : t("sendLink")}</SubmitButton>
      </form>
    </div>
  )
}

/** Real API: "Check your inbox" after the reset link was emailed (it opens /reset?token=…). */
export function SentView({ email, onBack }: { email: string; onBack: () => void }) {
  const t = useTranslations("auth")
  return (
    <div className="flex flex-col gap-[18px]" role="status">
      <BackButton onClick={onBack}>{t("backLogin")}</BackButton>
      <AuthHead
        icon={<MailCheckIcon className="size-5" />}
        title={t("sentTitle")}
        sub={
          <>
            {t("sentSub")} <strong className="font-semibold break-all text-foreground">{email}</strong>. {t("sentSub2")}
          </>
        }
      />
      <AuthNote>{t("spam")}</AuthNote>
    </div>
  )
}
