"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeftIcon, KeyRoundIcon, MailCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { forgotSchema, type ForgotValues } from "@/components/auth/auth-schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { retryAfterSeconds } from "@/lib/api/errors"
import { requestPasswordReset } from "@/lib/session"
import { useWaitText } from "@/lib/use-wait-text"

const iconTile = "flex size-12 items-center justify-center rounded-card bg-muted text-muted-foreground"

function BackToLogin({ onBack }: { onBack: () => void }) {
  const t = useTranslations("auth")
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {t("backLogin")}
    </button>
  )
}

/** Forgot password: email -> "Send reset link" (spinner) -> "Check your inbox" -> back to Log in. */
export function ForgotView({ onBack }: { onBack: () => void }) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } })
  const { errors } = form.formState
  const send = useMutation({
    mutationFn: (v: ForgotValues) => requestPasswordReset(v.email),
    onSuccess: setSentTo,
    onError: (e) => {
      const wait = retryAfterSeconds(e)
      if (wait !== undefined) toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
    },
  })

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-5 text-center" role="status">
        <span className={iconTile}>
          <MailCheckIcon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="type-h2">{t("sentTitle")}</h1>
          <p className="type-body text-muted-foreground">
            {t("sentSub")} <span className="font-medium text-foreground">{sentTo}</span>.
          </p>
          <p className="type-body text-muted-foreground">{t("sentSub2")}</p>
        </div>
        <BackToLogin onBack={onBack} />
      </div>
    )
  }

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => send.mutate(v))}>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className={iconTile}>
          <KeyRoundIcon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="type-h2">{t("forgotTitle")}</h1>
          <p className="type-body text-muted-foreground">{t("forgotSub")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">{t("email")}</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
          {...form.register("email")}
        />
        {errors.email ? (
          <p id="forgot-email-error" className="text-[13px] text-destructive">
            {t(errors.email.message as "emailRequired")}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="brand" size="lg" loading={send.isPending}>
        {t("sendLink")}
      </Button>
      <div className="flex justify-center">
        <BackToLogin onBack={onBack} />
      </div>
    </form>
  )
}
