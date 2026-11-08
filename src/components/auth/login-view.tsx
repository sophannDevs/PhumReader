"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { FacebookIcon, GoogleIcon } from "@/components/auth/social-icons"
import { loginSchema, type LoginValues } from "@/components/auth/auth-schemas"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { demoData } from "@/data"
import { errorCode, retryAfterSeconds } from "@/lib/api/errors"
import { currentUser, logIn, socialLogIn, type PendingCode } from "@/lib/session"
import { useAppStore, type StoredUser } from "@/lib/store"
import { useWaitText } from "@/lib/use-wait-text"

/** Log in: social buttons, email + password form, wrong-credentials alert, demo hint. */
export function LoginView({
  onForgot,
  onDone,
  onNeedsCode,
}: {
  onForgot: () => void
  /** Called after the store has the user; the flow shows the Done view. */
  onDone: () => void
  /** The email is not confirmed yet: the API sent a new code, the flow shows Verify. */
  onNeedsCode: (pending: PendingCode) => void
}) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  })
  const { errors } = form.formState

  const finish = (user: StoredUser) => {
    useAppStore.getState().login(user)
    onDone()
  }

  const emailLogin = useMutation({
    mutationFn: (v: LoginValues) => logIn(v.email, v.password, v.remember),
    onSuccess: finish,
    onError: (e, v) => {
      const code = errorCode(e)
      const wait = retryAfterSeconds(e)
      if (code === "invalid_credentials") {
        toast.error(t("errorTitle"), { description: t("errorBody"), duration: 5000 })
      } else if (code === "email_not_verified") {
        toast.info(t("unverified"), { duration: 5000 })
        onNeedsCode({ email: v.email.trim().toLowerCase(), resendAfterSeconds: 30 })
      } else if (wait !== undefined) {
        toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
      } else if (code === "account_banned") {
        toast.error(t("banned"), { duration: 5000 })
      } else {
        toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
      }
    },
  })
  const locale = useLocale()
  const social = useMutation({
    mutationFn: (provider: "google" | "facebook") => socialLogIn(provider, locale),
    onSuccess: finish,
    onError: () => toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 }),
  })

  // Back from Google / Facebook: the API redirected here with `?social=<result>` (cookies already set).
  const params = useSearchParams()
  const handled = useRef(false)
  useEffect(() => {
    const result = params.get("social")
    if (!result || handled.current) return
    handled.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete("social")
    window.history.replaceState(null, "", url)
    const failed = () => toast.error(ts("errorTitle"), { description: t("socialFailed"), duration: 5000 })
    if (result === "done") {
      currentUser()
        .then((user) => (user ? finish(user) : failed()))
        .catch(failed)
    } else if (result === "cancelled") toast.info(t("socialCancelled"), { duration: 5000 })
    else if (result === "unavailable") toast.info(t("socialSoon"), { duration: 5000 })
    else if (result === "social_no_email") toast.error(t("socialNoEmail"), { duration: 5000 })
    else if (result === "social_email_unverified") toast.error(t("socialUnverified"), { duration: 5000 })
    else if (result === "account_banned") toast.error(t("banned"), { duration: 5000 })
    else if (result === "too_many_requests") toast.error(t("tooManyTitle"), { duration: 5000 })
    else failed()
    // finish only calls the store and onDone; it is safe to leave out of the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  const busy = emailLogin.isPending || social.isPending

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy && !(social.isPending && social.variables === "google")}
          loading={social.isPending && social.variables === "google"}
          onClick={() => social.mutate("google")}
        >
          {!(social.isPending && social.variables === "google") && <GoogleIcon className="size-[18px]" />}
          {t("google")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy && !(social.isPending && social.variables === "facebook")}
          loading={social.isPending && social.variables === "facebook"}
          onClick={() => social.mutate("facebook")}
        >
          {!(social.isPending && social.variables === "facebook") && <FacebookIcon className="size-[18px]" />}
          {t("facebook")}
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        {t("orEmail")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => emailLogin.mutate(v))}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">{t("email")}</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...form.register("email")}
          />
          {errors.email ? (
            <p id="login-email-error" className="text-[13px] text-destructive">
              {t(errors.email.message as "emailRequired")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">{t("password")}</Label>
            <button
              type="button"
              onClick={onForgot}
              className="rounded-sm text-[13px] font-medium text-brand-ink underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("forgot")}
            </button>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            {...form.register("password")}
          />
          {errors.password ? (
            <p id="login-password-error" className="text-[13px] text-destructive">
              {t(errors.password.message as "passwordRequired")}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Controller
            control={form.control}
            name="remember"
            render={({ field }) => (
              <Checkbox id="login-remember" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
            )}
          />
          <Label htmlFor="login-remember" className="font-normal">
            {t("remember")}
          </Label>
        </div>

        <Button type="submit" variant="brand" size="lg" loading={emailLogin.isPending} disabled={busy && !emailLogin.isPending}>
          {t("login")}
        </Button>
      </form>

      <p className="type-small text-center font-normal text-muted-foreground">
        {t("demoHint", { email: demoData.demoAccount.email, password: demoData.demoAccount.password })}
      </p>
    </div>
  )
}
