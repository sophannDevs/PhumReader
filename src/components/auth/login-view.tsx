"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { AlertCircleIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { authDraft } from "@/components/auth/auth-draft"
import { loginSchema, type LoginValues } from "@/components/auth/auth-schemas"
import { AuthHead, AuthNote, authInput, authLink, FieldError, OrDivider, PasswordField, SubmitButton } from "@/components/auth/auth-ui"
import { AppleIcon, FacebookIcon, GoogleIcon } from "@/components/auth/social-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { demoData } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import { errorCode, retryAfterSeconds } from "@/lib/api/errors"
import { currentUser, logIn, socialLogIn, socialReady, type SocialProvider } from "@/lib/session"
import type { StoredUser } from "@/lib/store"
import { useWaitText } from "@/lib/use-wait-text"

/** The demo locks the form after 3 wrong passwords (prototype); the real API answers 429 after 5. */
const DEMO_TRIES = 3

const SOCIALS: { id: SocialProvider; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "google", icon: GoogleIcon },
  { id: "facebook", icon: FacebookIcon },
  { id: "apple", icon: AppleIcon },
]

type FormAlert = { title: string; text?: string; reset?: boolean }

/** Log in: email + password (Show, Caps Lock), Remember me, Forgot, wrong-password alert, social buttons, demo note. */
export function LoginView({
  onForgot,
  onSignup,
  onDone,
  onNeedsCode,
}: {
  onForgot: (email: string) => void
  onSignup: () => void
  /** The account is known: the flow logs it in and shows "Welcome back". */
  onDone: (user: StoredUser) => void
  /** The email is not confirmed yet: the API sent a new code, the flow shows the code step. */
  onNeedsCode: (email: string) => void
}) {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const locale = useLocale()
  const waitText = useWaitText()
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: authDraft.login?.email ?? "", password: "", remember: authDraft.login?.remember ?? true },
  })
  const { errors } = form.formState
  const [email, remember] = useWatch({ control: form.control, name: ["email", "remember"] })
  useEffect(() => {
    authDraft.login = { email, remember }
  }, [email, remember])

  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [alert, setAlert] = useState<FormAlert | null>(null)
  const [tries, setTries] = useState(0)
  const locked = DEMO_MODE && tries >= DEMO_TRIES

  const emailLogin = useMutation({
    mutationFn: (v: LoginValues) => logIn(v.email, v.password, v.remember),
    onSuccess: (user) => onDone(user),
    onError: (e, v) => {
      const code = errorCode(e)
      const wait = retryAfterSeconds(e)
      if (code === "invalid_credentials") {
        const n = tries + 1
        setTries(n)
        setAlert(DEMO_MODE && n >= DEMO_TRIES ? { title: t("locked"), reset: true } : { title: t("wrongCredentials") })
        // Prototype: the password is cleared and the field asks for it again.
        form.resetField("password")
        form.setError("password", { message: "passwordRequired" }, { shouldFocus: true })
      } else if (code === "email_not_verified") {
        toast.info(t("unverified"), { duration: 5000 })
        onNeedsCode(v.email.trim().toLowerCase())
      } else if (wait !== undefined) {
        setAlert({ title: t("tooManyTitle"), text: waitText(wait), reset: true })
      } else if (code === "account_banned") {
        setAlert({ title: t("banned") })
      } else {
        setAlert({ title: ts("errorTitle"), text: ts("errorDescription") })
      }
    },
  })

  const social = useMutation({
    mutationFn: (provider: SocialProvider) => socialLogIn(provider, locale),
    onSuccess: (user) => onDone(user),
    onError: () => setAlert({ title: ts("errorTitle"), text: t("socialFailed") }),
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
        .then((user) => (user ? onDone(user) : failed()))
        .catch(failed)
    } else if (result === "cancelled") toast.info(t("socialCancelled"), { duration: 5000 })
    else if (result === "unavailable") toast.info(t("socialSoon"), { duration: 5000 })
    else if (result === "social_no_email") toast.error(t("socialNoEmail"), { duration: 5000 })
    else if (result === "social_email_unverified") toast.error(t("socialUnverified"), { duration: 5000 })
    else if (result === "account_banned") toast.error(t("banned"), { duration: 5000 })
    else if (result === "too_many_requests") toast.error(t("tooManyTitle"), { duration: 5000 })
    else failed()
    // onDone only logs in and moves the flow on; it is safe to leave out of the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const busy = emailLogin.isPending || social.isPending
  const forgot = () => onForgot(form.getValues("email").trim())
  const accounts = demoData.demoAccounts

  return (
    <div className="flex flex-col gap-[18px]">
      <AuthHead title={t("loginTitle")} sub={t("loginSub")} />

      {alert ? (
        <Alert variant="destructive" className="rounded-[10px] px-4 py-3.5">
          <AlertCircleIcon aria-hidden />
          <AlertTitle className="text-sm leading-5">{alert.title}</AlertTitle>
          {alert.text || alert.reset ? (
            <AlertDescription className="flex flex-col items-start gap-1 text-[13px]">
              {alert.text ? <span>{alert.text}</span> : null}
              {alert.reset ? (
                <button type="button" className={authLink} onClick={forgot}>
                  {t("resetNow")}
                </button>
              ) : null}
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((v) => {
          if (locked) return
          setAlert(null)
          emailLogin.mutate(v)
        })}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="text-sm leading-5 font-medium">
            {t("email")}
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            className={authInput}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...form.register("email", { onChange: () => setAlert((a) => (a?.reset ? a : null)) })}
          />
          {errors.email ? <FieldError id="login-email-error">{t(errors.email.message as "emailRequired")}</FieldError> : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-sm leading-5 font-medium">
            {t("password")}
          </label>
          <PasswordField
            id="login-password"
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            visible={show}
            onVisibleChange={setShow}
            onCapsLock={setCaps}
            aria-invalid={!!errors.password}
            aria-describedby={[caps ? "login-caps" : "", errors.password ? "login-password-error" : ""].join(" ").trim() || undefined}
            {...form.register("password")}
          />
          {caps ? (
            <p id="login-caps" className="text-[13px] leading-[18px] font-medium text-warning">
              {t("caps")}
            </p>
          ) : null}
          {errors.password ? (
            <FieldError id="login-password-error">{t(errors.password.message as "passwordRequired")}</FieldError>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  id="login-remember"
                  className="border-[#a1a1aa]"
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                />
              )}
            />
            <label htmlFor="login-remember" className="cursor-pointer text-[13px] leading-[18px]">
              {t("remember")}
            </label>
          </div>
          <button type="button" className={authLink} onClick={forgot}>
            {t("forgot")}
          </button>
        </div>

        <SubmitButton loading={emailLogin.isPending}>{t("login")}</SubmitButton>
      </form>

      <OrDivider>{t("or")}</OrDivider>

      <div className="flex flex-col gap-2.5">
        {SOCIALS.map(({ id, icon: Icon }) => {
          const pending = social.isPending && social.variables === id
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              disabled={busy && !pending}
              loading={pending}
              className="h-11 w-full gap-2.5 rounded-full text-sm font-semibold shadow-none hover:border-[#d4d4d8]"
              onClick={() => {
                setAlert(null)
                if (socialReady(id)) social.mutate(id)
                else toast.info(t("appleSoon"), { duration: 5000 })
              }}
            >
              {pending ? null : <Icon className="size-[18px]" />}
              {t(id)}
            </Button>
          )
        })}
      </div>

      <p className="text-center text-sm leading-[21px] text-muted-foreground">
        {t("noAccount")}{" "}
        <button type="button" className={authLink} onClick={onSignup}>
          {t("createAccount")}
        </button>
      </p>

      {DEMO_MODE ? (
        <AuthNote>
          <span>{t("demoLogin", { email: accounts[0].email, password: accounts[0].password })}</span>
          {accounts.length > 2 ? (
            <span>
              {t("demoMore", {
                creator: accounts[1].email,
                creatorPassword: accounts[1].password,
                admin: accounts[2].email,
                adminPassword: accounts[2].password,
              })}
            </span>
          ) : null}
        </AuthNote>
      ) : null}
    </div>
  )
}
