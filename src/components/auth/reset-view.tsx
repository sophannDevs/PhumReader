"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { CheckIcon, KeyRoundIcon, LinkIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { resetSchema, type ResetValues } from "@/components/auth/auth-schemas"
import { PasswordInput } from "@/components/auth/password-input"
import { PasswordRules } from "@/components/auth/password-rules"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Link } from "@/i18n/navigation"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { resetPassword } from "@/lib/session"
import { useAppStore } from "@/lib/store"
import { useWaitText } from "@/lib/use-wait-text"

const iconTile = "flex size-12 items-center justify-center rounded-card bg-muted text-muted-foreground"

/**
 * /reset?token=…, opened from the emailed link (plan P4-09): choose a new password, then log in.
 * A used or expired link (30 minutes, once) offers a new one.
 */
export function ResetView() {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  const token = useSearchParams().get("token") ?? ""
  const [state, setState] = useState<"form" | "done" | "invalid">(token ? "form" : "invalid")
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: "" } })
  const { errors } = form.formState
  const password = useWatch({ control: form.control, name: "password" })

  const save = useMutation({
    mutationFn: (v: ResetValues) => resetPassword(token, v.password),
    onSuccess: () => {
      // Every device was signed out, this one too.
      useAppStore.getState().logout()
      setState("done")
    },
    onError: (e) => {
      const wait = retryAfterSeconds(e)
      if (errorCode(e) === "invalid_token") setState("invalid")
      else if (errorCode(e) === "password_too_weak" || fieldErrors(e).password)
        form.setError("password", { message: "passwordWeak" }, { shouldFocus: true })
      else if (wait !== undefined) toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
    },
  })

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-5 text-center" role="status">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-7" strokeWidth={3} aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="type-h2">{t("resetDoneTitle")}</h1>
          <p className="type-body text-muted-foreground">{t("resetDoneSub")}</p>
        </div>
        <Button asChild variant="brand" size="lg" className="w-full">
          <Link href="/login">{t("login")}</Link>
        </Button>
      </div>
    )
  }

  if (state === "invalid") {
    return (
      <div className="flex flex-col items-center gap-5 text-center" role="status">
        <span className={iconTile}>
          <LinkIcon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="type-h2">{t("resetInvalidTitle")}</h1>
          <p className="type-body text-muted-foreground">{t("resetInvalidSub")}</p>
        </div>
        <Button asChild variant="brand" size="lg" className="w-full">
          <Link href="/login?mode=forgot">{t("newLink")}</Link>
        </Button>
        <Link
          href="/login"
          className="rounded-sm text-sm font-medium outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("backLogin")}
        </Link>
      </div>
    )
  }

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className={iconTile}>
          <KeyRoundIcon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="type-h2">{t("resetTitle")}</h1>
          <p className="type-body text-muted-foreground">{t("resetSub")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-password">{t("newPassword")}</Label>
        <PasswordInput
          id="reset-password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "reset-password-error reset-rules" : "reset-rules"}
          {...form.register("password")}
        />
        <PasswordRules password={password ?? ""} id="reset-rules" />
        {errors.password ? (
          <p id="reset-password-error" className="text-[13px] text-destructive">
            {t(errors.password.message as "passwordWeak")}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="brand" size="lg" loading={save.isPending}>
        {t("savePassword")}
      </Button>
    </form>
  )
}
