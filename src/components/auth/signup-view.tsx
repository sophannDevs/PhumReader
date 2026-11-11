"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { ChevronDownIcon } from "lucide-react"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { authDraft } from "@/components/auth/auth-draft"
import { ageFrom, signupSchema, THIS_YEAR, type SignupValues } from "@/components/auth/auth-schemas"
import {
  AuthHead,
  AuthNote,
  authInput,
  authLink,
  FieldError,
  FieldHint,
  PasswordField,
  PasswordMeter,
  SubmitButton,
} from "@/components/auth/auth-ui"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { demoData } from "@/data"
import { Link } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { DEMO_MODE } from "@/lib/api/config"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { localDigits } from "@/lib/format"
import { signUp, type PendingCode } from "@/lib/session"
import { useWaitText } from "@/lib/use-wait-text"
import { cn } from "@/lib/utils"

const YEARS = Array.from({ length: THIS_YEAR - 1940 + 1 }, (_, i) => String(THIS_YEAR - i))
const LANGS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "km", label: "ខ្មែរ" },
]

/**
 * Sign up: display name, email ("already has an account" + Log in instead), password with the strength meter
 * and rules, confirm, app language, birth year (under 13 blocked, 13–17 note), terms. Next: the 6-digit code.
 */
export function SignupView({
  onLogin,
  onSubmitted,
}: {
  /** "Log in" / "Log in instead" (with the typed email). */
  onLogin: (email?: string) => void
  onSubmitted: (pending: PendingCode, ui: Locale) => void
}) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const locale = useLocale() as Locale
  const waitText = useWaitText()
  const saved = authDraft.signup
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: saved?.name ?? "",
      email: saved?.email ?? "",
      password: "",
      confirm: "",
      ui: saved?.ui ?? locale,
      year: saved?.year ?? "",
      terms: saved?.terms ?? false,
    },
  })
  const { errors, isSubmitted } = form.formState
  const [name, email, password, confirm, ui, year, terms] = useWatch({
    control: form.control,
    name: ["name", "email", "password", "confirm", "ui", "year", "terms"],
  })
  useEffect(() => {
    authDraft.signup = { name, email, ui, year, terms }
  }, [name, email, ui, year, terms])
  const [show, setShow] = useState(false)

  const create = useMutation({
    mutationFn: (v: SignupValues) => signUp({ name: v.name.trim(), email: v.email.trim(), password: v.password }, v.ui),
    onSuccess: (pending, v) => onSubmitted(pending, v.ui),
    onError: (e) => {
      // The API checks the same rules as the form; map its answers onto the fields.
      const fields = fieldErrors(e)
      const wait = retryAfterSeconds(e)
      if (errorCode(e) === "email_taken") form.setError("email", { message: "emailTaken" }, { shouldFocus: true })
      else if (errorCode(e) === "password_too_weak" || fields.password)
        form.setError("password", { message: "passwordRules" }, { shouldFocus: true })
      else if (fields.email) form.setError("email", { message: "emailInvalid" }, { shouldFocus: true })
      else if (fields.name) form.setError("name", { message: "nameRequired" }, { shouldFocus: true })
      else if (wait !== undefined) toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
    },
  })

  const age = ageFrom(year)
  const matches = !!confirm && confirm === password && !errors.confirm
  const describe = (...ids: (string | false)[]) => ids.filter(Boolean).join(" ") || undefined

  return (
    <div className="flex flex-col gap-[18px]">
      <AuthHead title={t("signupTitle")} sub={t("signupSub")} />

      <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
        <div className="flex flex-col gap-2">
          <label htmlFor="signup-name" className="text-sm leading-5 font-medium">
            {t("name")}
          </label>
          <Input
            id="signup-name"
            autoComplete="nickname"
            maxLength={20}
            placeholder={t("namePlaceholder")}
            className={authInput}
            aria-invalid={!!errors.name}
            aria-describedby="signup-name-note"
            {...form.register("name")}
          />
          {errors.name ? (
            <FieldError id="signup-name-note">{t(errors.name.message as "nameRequired")}</FieldError>
          ) : (
            <p id="signup-name-note" className="text-[13px] leading-[18px] text-muted-foreground">
              {t("nameHint")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="signup-email" className="text-sm leading-5 font-medium">
            {t("email")}
          </label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            className={authInput}
            aria-invalid={!!errors.email}
            aria-describedby={describe(!!errors.email && "signup-email-error")}
            {...form.register("email")}
          />
          {errors.email ? (
            <FieldError id="signup-email-error">
              {t(errors.email.message as "emailRequired")}
              {errors.email.message === "emailTaken" ? (
                <>
                  {" "}
                  <button type="button" className={authLink} onClick={() => onLogin(email.trim())}>
                    {t("loginInstead")}
                  </button>
                </>
              ) : null}
            </FieldError>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="signup-password" className="text-sm leading-5 font-medium">
            {t("password")}
          </label>
          <PasswordField
            id="signup-password"
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            visible={show}
            onVisibleChange={setShow}
            aria-invalid={!!errors.password}
            aria-describedby={describe("signup-rules", !!errors.password && "signup-password-error")}
            {...form.register("password", { onChange: () => isSubmitted && void form.trigger("confirm") })}
          />
          <PasswordMeter password={password ?? ""} id="signup-rules" />
          {errors.password ? (
            <FieldError id="signup-password-error">{t(errors.password.message as "passwordRules")}</FieldError>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="signup-confirm" className="text-sm leading-5 font-medium">
            {t("confirm")}
          </label>
          <Input
            id="signup-confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className={authInput}
            aria-invalid={!!errors.confirm}
            aria-describedby={describe((!!errors.confirm || matches) && "signup-confirm-note")}
            {...form.register("confirm")}
          />
          {errors.confirm ? (
            <FieldError id="signup-confirm-note">{t(errors.confirm.message as "mismatch")}</FieldError>
          ) : matches ? (
            <p id="signup-confirm-note" className="text-[13px] leading-[18px] font-semibold text-brand-ink">
              {t("match")}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <span id="signup-ui" className="text-sm leading-5 font-medium">
              {t("uiLang")}
            </span>
            <Controller
              control={form.control}
              name="ui"
              render={({ field }) => (
                <div role="group" aria-labelledby="signup-ui" className="grid h-11 grid-cols-2 gap-0.5 rounded-[10px] bg-muted p-[3px]">
                  {LANGS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      lang={l.value}
                      aria-pressed={field.value === l.value}
                      onClick={() => field.onChange(l.value)}
                      className={cn(
                        "min-w-0 rounded-lg text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        l.value === "km" && "font-khmer",
                        field.value === l.value
                          ? "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="signup-year" className="text-sm leading-5 font-medium">
              {t("birthYear")}
            </label>
            <div className="relative">
              <select
                id="signup-year"
                aria-invalid={!!errors.year}
                aria-describedby="signup-year-note"
                className="h-11 w-full min-w-0 cursor-pointer appearance-none rounded-[10px] border border-input bg-background pr-8 pl-3 text-[15px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive"
                {...form.register("year")}
              >
                <option value="">{t("choose")}</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {localDigits(y, locale)}
                  </option>
                ))}
              </select>
              <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-[#71717a]" />
            </div>
          </div>
        </div>
        {errors.year ? (
          <FieldError id="signup-year-note" className="-mt-1.5">
            {t(errors.year.message as "yearRequired")}
          </FieldError>
        ) : (
          <FieldHint className="-mt-1.5">
            <span id="signup-year-note">{age >= 13 && age < 18 ? t("teenNote") : t("adultNote")}</span>
          </FieldHint>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Controller
              control={form.control}
              name="terms"
              render={({ field }) => (
                <Checkbox
                  id="signup-terms"
                  className="mt-0.5 border-[#a1a1aa]"
                  checked={field.value}
                  aria-invalid={!!errors.terms}
                  aria-describedby={errors.terms ? "signup-terms-error" : undefined}
                  onCheckedChange={(c) => field.onChange(c === true)}
                />
              )}
            />
            <label htmlFor="signup-terms" className="cursor-pointer text-[13px] leading-[18px]">
              {t.rich("agree", {
                terms: (chunks) => (
                  <Link href="/terms" target="_blank" className={authLink}>
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/privacy" target="_blank" className={authLink}>
                    {chunks}
                  </Link>
                ),
              })}
            </label>
          </div>
          {errors.terms ? (
            <FieldError id="signup-terms-error">{t(errors.terms.message as "termsRequired")}</FieldError>
          ) : null}
        </div>

        <SubmitButton loading={create.isPending}>{t("create")}</SubmitButton>
      </form>

      <p className="text-center text-sm leading-[21px] text-muted-foreground">
        {t("haveAccount")}{" "}
        <button type="button" className={authLink} onClick={() => onLogin()}>
          {t("login")}
        </button>
      </p>

      {DEMO_MODE ? (
        <AuthNote>
          {t("demoSignup", {
            emails: demoData.demoAccounts.map((a) => a.email).join(", "),
            code: demoData.emailCode,
          })}
        </AuthNote>
      ) : null}
    </div>
  )
}
