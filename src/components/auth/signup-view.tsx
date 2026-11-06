"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { signupSchema, type SignupValues } from "@/components/auth/auth-schemas"
import { PasswordInput } from "@/components/auth/password-input"
import { PasswordRules } from "@/components/auth/password-rules"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { signUp, type PendingCode } from "@/lib/session"
import { useWaitText } from "@/lib/use-wait-text"

/** Sign up: name, email, password with a strength bar and live rules, terms. Next: Verify. */
export function SignupView({ onSubmitted }: { onSubmitted: (pending: PendingCode) => void }) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const locale = useLocale()
  const waitText = useWaitText()
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", terms: false },
  })
  const { errors } = form.formState
  const password = useWatch({ control: form.control, name: "password" })

  const create = useMutation({
    mutationFn: (v: SignupValues) =>
      signUp({ name: v.name.trim(), email: v.email.trim(), password: v.password }, locale),
    onSuccess: onSubmitted,
    onError: (e) => {
      // The API checks the same rules as the form; map its answers onto the fields.
      const fields = fieldErrors(e)
      const wait = retryAfterSeconds(e)
      if (errorCode(e) === "email_taken") form.setError("email", { message: "emailTaken" }, { shouldFocus: true })
      else if (errorCode(e) === "password_too_weak" || fields.password)
        form.setError("password", { message: "passwordWeak" }, { shouldFocus: true })
      else if (fields.email) form.setError("email", { message: "emailInvalid" }, { shouldFocus: true })
      else if (fields.name) form.setError("name", { message: "nameRequired" }, { shouldFocus: true })
      else if (wait !== undefined) toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
    },
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-name">{t("name")}</Label>
        <Input
          id="signup-name"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "signup-name-error" : undefined}
          {...form.register("name")}
        />
        {errors.name ? (
          <p id="signup-name-error" className="text-[13px] text-destructive">
            {t(errors.name.message as "nameRequired")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">{t("email")}</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          {...form.register("email")}
        />
        {errors.email ? (
          <p id="signup-email-error" className="text-[13px] text-destructive">
            {t(errors.email.message as "emailRequired")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-password">{t("password")}</Label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "signup-password-error signup-rules" : "signup-rules"}
          {...form.register("password")}
        />
        <PasswordRules password={password ?? ""} id="signup-rules" />
        {errors.password ? (
          <p id="signup-password-error" className="text-[13px] text-destructive">
            {t(errors.password.message as "passwordWeak")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <Checkbox
                id="signup-terms"
                className="mt-0.5"
                checked={field.value}
                aria-invalid={!!errors.terms}
                aria-describedby={errors.terms ? "signup-terms-error" : undefined}
                onCheckedChange={(c) => field.onChange(c === true)}
              />
            )}
          />
          <Label htmlFor="signup-terms" className="leading-5 font-normal">
            {t("terms")}
          </Label>
        </div>
        {errors.terms ? (
          <p id="signup-terms-error" className="text-[13px] text-destructive">
            {t(errors.terms.message as "termsRequired")}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="brand" size="lg" loading={create.isPending}>
        {t("create")}
      </Button>
    </form>
  )
}
