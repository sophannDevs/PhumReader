"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { newPasswordSchema, type NewPasswordValues } from "@/components/auth/auth-schemas"
import { authInput, FieldError, PasswordField, PasswordMeter, SubmitButton } from "@/components/auth/auth-ui"
import { Input } from "@/components/ui/input"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { useWaitText } from "@/lib/use-wait-text"

/**
 * "Choose a new password": new password (Show) with the strength meter and rules, confirm, "Save new password".
 * Used by the demo's code flow (/login?mode=forgot) and by /reset?token=… (real API link).
 */
export function NewPasswordForm({
  save,
  onSaved,
  onInvalidToken,
}: {
  save: (password: string) => Promise<void>
  onSaved: () => void
  /** /reset: the link was used or has expired. */
  onInvalidToken?: () => void
}) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  const form = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } })
  const { errors, isSubmitted } = form.formState
  const password = useWatch({ control: form.control, name: "password" })
  const [show, setShow] = useState(false)

  const mutation = useMutation({
    mutationFn: (v: NewPasswordValues) => save(v.password),
    onSuccess: onSaved,
    onError: (e) => {
      const wait = retryAfterSeconds(e)
      if (errorCode(e) === "invalid_token" && onInvalidToken) onInvalidToken()
      else if (errorCode(e) === "password_too_weak" || fieldErrors(e).password)
        form.setError("password", { message: "passwordRules" }, { shouldFocus: true })
      else if (wait !== undefined) toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
    },
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
      <div className="flex flex-col gap-2">
        <label htmlFor="new-password" className="text-sm leading-5 font-medium">
          {t("newPassword")}
        </label>
        <PasswordField
          id="new-password"
          autoComplete="new-password"
          autoFocus
          visible={show}
          onVisibleChange={setShow}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "new-password-rules new-password-error" : "new-password-rules"}
          {...form.register("password", { onChange: () => isSubmitted && void form.trigger("confirm") })}
        />
        <PasswordMeter password={password ?? ""} id="new-password-rules" />
        {errors.password ? (
          <FieldError id="new-password-error">{t(errors.password.message as "passwordRules")}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="new-password-confirm" className="text-sm leading-5 font-medium">
          {t("confirm")}
        </label>
        <Input
          id="new-password-confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={authInput}
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? "new-password-confirm-error" : undefined}
          {...form.register("confirm")}
        />
        {errors.confirm ? (
          <FieldError id="new-password-confirm-error">{t(errors.confirm.message as "mismatch")}</FieldError>
        ) : null}
      </div>

      <SubmitButton loading={mutation.isPending}>{t("savePassword")}</SubmitButton>
    </form>
  )
}
