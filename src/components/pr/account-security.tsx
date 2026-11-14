"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { LaptopIcon } from "@/components/animate-ui/icons/laptop"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { SmartphoneIcon } from "@/components/animate-ui/icons/smartphone"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { PasswordInput } from "@/components/auth/password-input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "@/i18n/navigation"
import * as account from "@/lib/api/account"
import { DEMO_MODE } from "@/lib/api/config"
import { withDemo } from "@/lib/demo-api"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { meKeys } from "@/lib/api/keys"
import { UploadError, uploadImage } from "@/lib/api/uploads"
import { formatDate, initials } from "@/lib/format"
import { toUser } from "@/lib/session"
import { defaultSettings, useAppStore, useCoins, useUser } from "@/lib/store"
import { useRestoreFocus } from "@/lib/use-restore-focus"
import { useWaitText } from "@/lib/use-wait-text"
import { cn } from "@/lib/utils"

/**
 * Account pieces of Settings (V2.1, prototype Settings/): profile photo, email, inline password change, the
 * devices signed in, and delete account. Demo mode simulates them on the store; with the real API they call
 * /me/avatar, /auth/change-password, /auth/change-email, /auth/devices and /auth/delete-account.
 */

/** One toast for any failed account call: a wait for 429, a general message otherwise. */
function useFailureToast() {
  const t = useTranslations("auth")
  const ts = useTranslations("states")
  const waitText = useWaitText()
  return (error: unknown) => {
    const wait = retryAfterSeconds(error)
    if (wait !== undefined) toast.error(t("tooManyTitle"), { description: waitText(wait), duration: 5000 })
    else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
  }
}

export const fieldLabel = "text-sm leading-5 font-medium"
export const fieldHint = "text-[13px] leading-[18px] text-muted-foreground"
export const fieldError = "text-[13px] leading-[18px] font-medium text-destructive"
const field = "flex min-w-0 flex-col gap-2"

// ---------------------------------------------------------------- profile photo

/** 56 px avatar with "Change photo": the demo only says so; the real API uploads a square JPG / PNG and sets it. */
export function AvatarRow({ name }: { name: string }) {
  const t = useTranslations("account")
  const user = useUser()
  const failed = useFailureToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const uploadError = (e: UploadError) =>
    e.code === "unsupported_type"
      ? t("photoType")
      : e.code === "file_too_large"
        ? t("photoTooBig")
        : e.code === "image_too_small"
          ? t("photoTooSmall", { min: e.detail.min ?? 200 })
          : e.code === "not_square"
            ? t("photoNotSquare")
            : t("photoFailed")

  async function pick(file: File) {
    setBusy(true)
    try {
      const image = await uploadImage(file, "AVATAR")
      const me = await account.setAvatar(image.id)
      useAppStore.getState().login(toUser(me))
      toast.success(t("avatarSaved"))
    } catch (e) {
      if (e instanceof UploadError) toast.error(uploadError(e))
      else failed(e)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  async function remove() {
    setBusy(true)
    try {
      useAppStore.getState().login(toUser(await account.removeAvatar()))
      toast.success(t("avatarRemoved"))
    } catch (e) {
      failed(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3.5">
      <Avatar variant="brand" className="size-14 after:border-0">
        {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={busy}
            onClick={() => (DEMO_MODE ? toast(t("photoDemo")) : input.current?.click())}
          >
            {t("changePhoto")}
          </Button>
          {!DEMO_MODE && user?.avatarUrl ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
              {t("removePhoto")}
            </Button>
          ) : null}
        </div>
        <span className="text-xs leading-4 text-muted-foreground">{DEMO_MODE ? t("photoHint") : t("avatarHint")}</span>
        {DEMO_MODE ? null : (
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void pick(file)
            }}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- email

/** The account's email with "Verified"; the real API can change it (6-digit code to the new address). */
export function EmailField({ email }: { email: string }) {
  const t = useTranslations("account")
  const [open, setOpen] = useState(false)
  return (
    <div className={field}>
      <span className={fieldLabel}>{t("email")}</span>
      <div className="flex h-9 min-w-0 items-center gap-2 rounded-control border bg-subtle px-3 text-sm">
        <span className="truncate">{email}</span>
        <Badge variant="brand">
          <CheckIcon className="size-3" aria-hidden />
          {t("verified")}
        </Badge>
      </div>
      {DEMO_MODE ? (
        <span className={fieldHint}>{t("emailHelp")}</span>
      ) : (
        <span className={cn(fieldHint, "flex flex-wrap items-center gap-x-1")}>
          {t("emailChangeHint")}
          <Button variant="link" className="h-auto p-0 text-[13px]" onClick={() => setOpen(true)}>
            {t("changeEmail")}
          </Button>
        </span>
      )}
      {DEMO_MODE ? null : <ChangeEmailDialog open={open} onOpenChange={setOpen} />}
    </div>
  )
}

const emailSchema = z.object({
  newEmail: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "invalid"),
  password: z.string().min(1, "required"),
})
type EmailValues = z.infer<typeof emailSchema>

function ChangeEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("account")
  const ts = useTranslations("settings")
  const ta = useTranslations("auth")
  const failed = useFailureToast()
  const restoreFocus = useRestoreFocus()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const form = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { newEmail: "", password: "" } })
  const { errors } = form.formState

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setSentTo(null)
      setCode("")
      form.reset()
    }
  }

  const send = useMutation({
    mutationFn: (v: EmailValues) => account.changeEmail(v.newEmail, v.password),
    onSuccess: (r) => setSentTo(r.email),
    onError: (e) => {
      const fields = fieldErrors(e)
      if (fields.password) form.setError("password", { message: "wrong" }, { shouldFocus: true })
      else if (fields.newEmail) form.setError("newEmail", { message: fields.newEmail }, { shouldFocus: true })
      else failed(e)
    },
  })

  const confirm = useMutation({
    mutationFn: () => account.confirmEmail(code),
    onSuccess: (me) => {
      useAppStore.getState().login(toUser(me))
      toast.success(t("emailChanged"))
      close(false)
    },
    onError: (e) => {
      if (["invalid_code", "code_expired", "too_many_attempts"].includes(errorCode(e) ?? "")) setCode("")
      else failed(e)
    },
  })
  const wrongCode = confirm.isError && ["invalid_code", "code_expired", "too_many_attempts"].includes(errorCode(confirm.error) ?? "")

  const emailMessage = (key?: string) =>
    key === "email_taken" ? t("emailTaken") : key === "same_email" ? t("sameEmail") : ta("emailInvalid")

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent {...restoreFocus}>
        {sentTo ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 6) confirm.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("changeEmail")}</DialogTitle>
              <DialogDescription>{t("codeSentTo", { email: sentTo })}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-2">
              <InputOTP maxLength={6} value={code} autoFocus pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" aria-label={ta("codeLabel")} aria-invalid={wrongCode} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {wrongCode ? (
                <p role="alert" className={fieldError}>
                  {t("codeWrong")}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {ts("cancel")}
              </Button>
              <Button type="submit" variant="brand" loading={confirm.isPending} disabled={code.length < 6}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => send.mutate(v))} noValidate>
            <DialogHeader>
              <DialogTitle>{t("changeEmail")}</DialogTitle>
              <DialogDescription>{t("changeEmailDesc")}</DialogDescription>
            </DialogHeader>
            <div className={field}>
              <Label htmlFor="new-email">{t("newEmail")}</Label>
              <Input id="new-email" type="email" autoComplete="email" aria-invalid={!!errors.newEmail} {...form.register("newEmail")} />
              {errors.newEmail ? (
                <p role="alert" className={fieldError}>
                  {emailMessage(errors.newEmail.message)}
                </p>
              ) : null}
            </div>
            <div className={field}>
              <Label htmlFor="email-password">{t("currentPassword")}</Label>
              <PasswordInput id="email-password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register("password")} />
              {errors.password ? (
                <p role="alert" className={fieldError}>
                  {errors.password.message === "wrong" ? t("wrongPassword") : ta("passwordRequired")}
                </p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {ts("cancel")}
              </Button>
              <Button type="submit" variant="brand" loading={send.isPending}>
                {t("sendCode")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- change password (inline)

/** V2.1 rule (spec §12): 8+ characters with a letter and a number. */
const passwordRule = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)

/** "Password" row; "Change password" opens the form inline (current, new, confirm). */
export function PasswordRow() {
  const t = useTranslations("account")
  const ts = useTranslations("settings")
  const failed = useFailureToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState({ cur: "", nw: "", again: "" })
  const [error, setError] = useState("")

  const save = useMutation({
    // Demo: the fake API (delay, ?demo=error), nothing is stored.
    mutationFn: () => (DEMO_MODE ? withDemo(() => undefined) : account.changePassword(pw.cur, pw.nw)),
    onSuccess: () => {
      toast.success(t(DEMO_MODE ? "passwordUpdated" : "passwordChanged"))
      void qc.invalidateQueries({ queryKey: meKeys.devicesAll })
      toggle(false)
    },
    onError: (e) => {
      const fields = fieldErrors(e)
      if (fields.currentPassword) setError(t("wrongPassword"))
      else if (fields.newPassword) setError(t("passwordWeakApi"))
      else failed(e)
    },
  })

  function toggle(next: boolean) {
    setOpen(next)
    setPw({ cur: "", nw: "", again: "" })
    setError("")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = !pw.cur
      ? t("pwCurrentRequired")
      : !passwordRule(pw.nw)
        ? t("pwRule")
        : pw.nw !== pw.again
          ? t("pwMismatch")
          : pw.nw === pw.cur
            ? t("pwSame")
            : ""
    if (problem) return setError(problem)
    save.mutate()
  }

  const onField = (k: keyof typeof pw) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPw((x) => ({ ...x, [k]: e.target.value }))
    setError("")
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 max-md:items-start">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={fieldLabel}>{t("password")}</span>
          <span className={fieldHint}>{DEMO_MODE ? t("passwordAge") : t("changePasswordDesc")}</span>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" aria-expanded={open} onClick={() => toggle(!open)}>
          {open ? ts("close") : t("changePassword")}
        </Button>
      </div>
      {open ? (
        <form className="flex flex-col gap-3.5 rounded-[10px] border bg-subtle p-4" onSubmit={submit} noValidate>
          <div className={field}>
            <Label htmlFor="pw-cur">{t("currentPassword")}</Label>
            <PasswordInput id="pw-cur" autoComplete="current-password" value={pw.cur} onChange={onField("cur")} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={field}>
              <Label htmlFor="pw-new">{t("newPassword")}</Label>
              <PasswordInput id="pw-new" autoComplete="new-password" aria-describedby="pw-h" value={pw.nw} onChange={onField("nw")} />
              <span id="pw-h" className={fieldHint}>
                {t("pwHint")}
              </span>
            </div>
            <div className={field}>
              <Label htmlFor="pw-again">{t("confirmPassword")}</Label>
              <PasswordInput id="pw-again" autoComplete="new-password" value={pw.again} onChange={onField("again")} />
            </div>
          </div>
          {error ? (
            <p role="alert" className={fieldError}>
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="brand" size="sm" loading={save.isPending}>
              {t("updatePassword")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => toggle(false)}>
              {ts("cancel")}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------- devices (real API)

export function Devices() {
  const t = useTranslations("account")
  const locale = useLocale()
  const qc = useQueryClient()
  const failed = useFailureToast()
  const user = useUser()
  const query = useQuery({ queryKey: meKeys.devices(user?.email), queryFn: account.fetchDevices, enabled: !!user })

  const signOut = useMutation({
    mutationFn: account.signOutDevice,
    onSuccess: () => {
      toast.success(t("deviceSignedOut"))
      void qc.invalidateQueries({ queryKey: meKeys.devicesAll })
    },
    onError: failed,
  })

  return (
    <div className="flex flex-col gap-2">
      <span className={fieldLabel}>{t("devices")}</span>
      {query.isPending ? (
        <Skeleton className="h-14 rounded-[10px]" />
      ) : query.isError ? (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => void query.refetch()}>
          {t("devicesRetry")}
        </Button>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y rounded-[10px] border p-0">
          {query.data.map((d) => {
            const Icon = /android|ios|phone/i.test(d.system ?? "") ? SmartphoneIcon : LaptopIcon
            const name = [d.browser, d.system].filter(Boolean).join(" · ") || t("unknownDevice")
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] font-semibold">
                    {name}
                    {d.current ? <Badge variant="brand">{t("thisDevice")}</Badge> : null}
                  </span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    {t("lastActive", { date: formatDate(d.lastActiveAt.slice(0, 10), locale) })}
                  </span>
                </div>
                {d.current ? null : (
                  <Button variant="outline" size="sm" loading={signOut.isPending && signOut.variables === d.id} onClick={() => signOut.mutate(d.id)}>
                    {t("signOutDevice")}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- delete account

/**
 * "Delete your account?" (screen 12-settings-delete-dialog): type DELETE to confirm. The real API also asks for
 * the password and erases the account after its grace period; the demo clears this device's account data.
 */
export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("account")
  const ts = useTranslations("settings")
  const locale = useLocale()
  const router = useRouter()
  const coins = useCoins()
  const failed = useFailureToast()
  const restoreFocus = useRestoreFocus()
  const [text, setText] = useState("")
  const [password, setPassword] = useState("")
  const [wrong, setWrong] = useState(false)

  const remove = useMutation({
    mutationFn: () => account.deleteAccount(password),
    onSuccess: (deleteAfter) => {
      toast.success(t("deleted", { date: formatDate(deleteAfter.slice(0, 10), locale) }), { duration: 8000 })
      close(false)
      // Every device was signed out, this one too.
      useAppStore.getState().logout()
    },
    onError: (e) => {
      if (fieldErrors(e).password) setWrong(true)
      else failed(e)
    },
  })

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setText("")
      setPassword("")
      setWrong(false)
    }
  }

  const typed = text.trim() === "DELETE"
  const ready = typed && (DEMO_MODE || password.length > 0)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    if (!DEMO_MODE) return remove.mutate()
    const s = useAppStore.getState()
    const email = s.user?.email
    useAppStore.setState({
      user: null,
      subscriptions: [],
      lastRead: {},
      unlocked: {},
      pos: {},
      historyHidden: [],
      coins: 3,
      settings: { ...defaultSettings, langs: [...defaultSettings.langs] },
      accounts: s.accounts.filter((a) => a.email !== email),
    })
    close(false)
    toast.success(t("accountDeleted"))
    setTimeout(() => router.push("/"), 800)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        {...restoreFocus}
        showCloseButton={false}
        role="alertdialog"
        className="md:top-40 md:translate-y-0"
      >
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <DialogHeader className="gap-3">
            <DialogTitle className="type-h3">{t("deleteTitle")}</DialogTitle>
            <DialogDescription className="text-[13px] leading-[18px]">
              {t("deleteLose", { coins })}
              {DEMO_MODE ? null : ` ${t("deleteDesc")}`}
            </DialogDescription>
          </DialogHeader>
          <div className={field}>
            <Label htmlFor="del-in">{t("typeDelete")}</Label>
            <Input id="del-in" value={text} autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(e) => setText(e.target.value)} />
          </div>
          {DEMO_MODE ? null : (
            <div className={field}>
              <Label htmlFor="delete-password">{t("currentPassword")}</Label>
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                value={password}
                aria-invalid={wrong}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setWrong(false)
                }}
              />
              {wrong ? (
                <p role="alert" className={fieldError}>
                  {t("wrongPassword")}
                </p>
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {ts("cancel")}
            </Button>
            <Button type="submit" variant="destructive" loading={remove.isPending} disabled={!ready}>
              {t("deleteAccount")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
