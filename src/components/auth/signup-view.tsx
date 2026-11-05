"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { CheckIcon, CircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { passwordChecks, signupSchema, type SignupValues } from "@/components/auth/auth-schemas"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DemoApiError, signUp } from "@/lib/demo-api"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export type SignupData = { name: string; email: string; password: string }

/** Sign up: name, email, password with a strength bar and live rules, terms. Next: Verify. */
export function SignupView({ onSubmitted }: { onSubmitted: (data: SignupData) => void }) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", terms: false },
  })
  const { errors } = form.formState
  const password = useWatch({ control: form.control, name: "password" })
  const checks = passwordChecks(password ?? "")
  const met = checks.filter(Boolean).length

  const create = useMutation({
    mutationFn: (v: SignupValues) =>
      signUp(
        { name: v.name.trim(), email: v.email.trim(), password: v.password },
        useAppStore.getState().accounts.map((a) => a.email)
      ),
    onSuccess: (_, v) => onSubmitted({ name: v.name.trim(), email: v.email.trim(), password: v.password }),
    onError: (e) => {
      if (e instanceof DemoApiError && e.code === "email_taken") form.setError("email", { message: "emailTaken" })
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
        <div
          role="img"
          aria-label={t("strength", { count: met })}
          data-met={met}
          className="grid grid-cols-4 gap-1.5"
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              data-filled={i < met}
              className={cn("h-1.5 rounded-full bg-muted transition-colors", i < met && (met >= 3 ? "bg-primary" : "bg-coin"))}
            />
          ))}
        </div>
        <ul id="signup-rules" className="grid grid-cols-2 gap-x-3 gap-y-1">
          {checks.map((ok, i) => (
            <li
              key={i}
              data-met={ok}
              className={cn("flex items-center gap-1.5 text-[13px]", ok ? "text-brand-ink" : "text-muted-foreground")}
            >
              {ok ? <CheckIcon className="size-3.5" aria-hidden /> : <CircleIcon className="size-3.5" aria-hidden />}
              {t(`rule${i}` as "rule0")}
              <span className="sr-only">{ok ? t("ruleMet") : t("ruleUnmet")}</span>
            </li>
          ))}
        </ul>
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
