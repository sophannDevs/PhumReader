"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { LaptopIcon, PencilIcon, SmartphoneIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { passwordChecks } from "@/components/auth/auth-schemas"
import { PasswordInput } from "@/components/auth/password-input"
import { PasswordRules } from "@/components/auth/password-rules"
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
import * as account from "@/lib/api/account"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { formatDate } from "@/lib/format"
import { logOut } from "@/lib/session"
import { useAppStore, useUser } from "@/lib/store"
import { useRestoreFocus } from "@/lib/use-restore-focus"
import { useWaitText } from "@/lib/use-wait-text"

/**
 * Account settings that only exist with a real account (real API): rename, change password and
 * email, the devices signed in, and delete account. The demo has no such account, so it does not
 * show these.
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

const field = "flex flex-col gap-1.5"
const fieldError = "type-small font-normal text-destructive"

// ---------------------------------------------------------------- display name

export function DisplayNameEditor() {
  const t = useTranslations("account")
  const ts = useTranslations("settings")
  const user = useUser()
  const failed = useFailureToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => account.patchProfile(name.trim()),
    onSuccess: (me) => {
      useAppStore.getState().login({ name: me.displayName, email: me.email })
      toast.success(t("nameSaved"))
      setEditing(false)
    },
    onError: (e) => {
      if (fieldErrors(e).displayName) setError(t("nameInvalid"))
      else failed(e)
    },
  })

  if (!user) return null
  if (!editing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setName(user.name)
          setError(null)
          setEditing(true)
        }}
      >
        <PencilIcon />
        {t("edit")}
      </Button>
    )
  }
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim().length < 2) setError(t("nameInvalid"))
        else save.mutate()
      }}
    >
      <Label htmlFor="display-name">{ts("displayName")}</Label>
      <Input id="display-name" value={name} maxLength={60} autoFocus aria-invalid={!!error} onChange={(e) => setName(e.target.value)} />
      {error ? (
        <p role="alert" className={fieldError}>
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="brand" size="sm" loading={save.isPending}>
          {t("save")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
          {ts("cancel")}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- change password

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "required"),
  newPassword: z.string().refine((v) => passwordChecks(v).filter(Boolean).length >= 3, "weak"),
})
type PasswordValues = z.infer<typeof passwordSchema>

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("account")
  const ts = useTranslations("settings")
  const ta = useTranslations("auth")
  const failed = useFailureToast()
  const restoreFocus = useRestoreFocus()
  const qc = useQueryClient()
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "" } })
  const { errors } = form.formState
  const next = useWatch({ control: form.control, name: "newPassword" })

  const save = useMutation({
    mutationFn: (v: PasswordValues) => account.changePassword(v.currentPassword, v.newPassword),
    onSuccess: () => {
      toast.success(t("passwordChanged"))
      void qc.invalidateQueries({ queryKey: ["devices"] })
      form.reset()
      onOpenChange(false)
    },
    onError: (e) => {
      const fields = fieldErrors(e)
      if (fields.currentPassword) form.setError("currentPassword", { message: "wrong" }, { shouldFocus: true })
      else if (fields.newPassword) form.setError("newPassword", { message: "weak" }, { shouldFocus: true })
      else failed(e)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...restoreFocus}>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <DialogHeader>
            <DialogTitle>{t("changePassword")}</DialogTitle>
            <DialogDescription>{t("changePasswordDesc")}</DialogDescription>
          </DialogHeader>
          <div className={field}>
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <PasswordInput id="current-password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...form.register("currentPassword")} />
            {errors.currentPassword ? (
              <p role="alert" className={fieldError}>
                {errors.currentPassword.message === "wrong" ? t("wrongPassword") : ta("passwordRequired")}
              </p>
            ) : null}
          </div>
          <div className={field}>
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <PasswordInput id="new-password" autoComplete="new-password" aria-invalid={!!errors.newPassword} aria-describedby="new-password-rules" {...form.register("newPassword")} />
            <PasswordRules password={next} id="new-password-rules" />
            {errors.newPassword ? (
              <p role="alert" className={fieldError}>
                {ta("passwordWeak")}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ts("cancel")}
            </Button>
            <Button type="submit" variant="brand" loading={save.isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- change email

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
      useAppStore.getState().login({ name: me.displayName, email: me.email })
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
              <Button type="button" variant="outline" onClick={() => close(false)}>
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
              <Button type="button" variant="outline" onClick={() => close(false)}>
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

// ---------------------------------------------------------------- delete account

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("account")
  const ts = useTranslations("settings")
  const locale = useLocale()
  const failed = useFailureToast()
  const restoreFocus = useRestoreFocus()
  const [password, setPassword] = useState("")
  const [wrong, setWrong] = useState(false)

  const remove = useMutation({
    mutationFn: () => account.deleteAccount(password),
    onSuccess: (deleteAfter) => {
      toast.success(t("deleted", { date: formatDate(deleteAfter.slice(0, 10), locale) }), { duration: 8000 })
      onOpenChange(false)
      // Every device was signed out, this one too.
      useAppStore.getState().logout()
    },
    onError: (e) => {
      if (fieldErrors(e).password) setWrong(true)
      else failed(e)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setPassword("")
          setWrong(false)
        }
      }}
    >
      <DialogContent {...restoreFocus}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (password) remove.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteBody")}</DialogDescription>
          </DialogHeader>
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
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ts("cancel")}
            </Button>
            <Button type="submit" variant="destructive" loading={remove.isPending} disabled={!password}>
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- devices

function Devices() {
  const t = useTranslations("account")
  const locale = useLocale()
  const qc = useQueryClient()
  const failed = useFailureToast()
  const user = useUser()
  const query = useQuery({ queryKey: ["devices", user?.email ?? ""], queryFn: account.fetchDevices, enabled: !!user })

  const signOut = useMutation({
    mutationFn: account.signOutDevice,
    onSuccess: () => {
      toast.success(t("deviceSignedOut"))
      void qc.invalidateQueries({ queryKey: ["devices"] })
    },
    onError: failed,
  })
  const everywhere = useMutation({
    mutationFn: account.signOutEverywhere,
    // Every device was signed out, this one too.
    onSuccess: () => void logOut(),
    onError: failed,
  })

  if (query.isPending) return <Skeleton className="h-14 rounded-control" />
  if (query.isError) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => void query.refetch()}>
        {t("devicesRetry")}
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-control border">
        {query.data.map((d) => {
          const Icon = /android|ios|phone/i.test(d.system ?? "") ? SmartphoneIcon : LaptopIcon
          const name = [d.browser, d.system].filter(Boolean).join(" · ") || t("unknownDevice")
          return (
            <li key={d.id} className="flex items-center gap-3 p-3">
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {name}
                  {d.current ? <Badge variant="brand">{t("thisDevice")}</Badge> : null}
                </span>
                <span className="type-caption font-normal text-muted-foreground">
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
      {query.data.length > 1 ? (
        <Button variant="outline" className="w-fit" loading={everywhere.isPending} onClick={() => everywhere.mutate()}>
          {t("signOutAll")}
        </Button>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- the section

/** Security section of Settings: password, email, devices and deleting the account. */
export function SecuritySection({ card }: { card: string }) {
  const t = useTranslations("account")
  const [dialog, setDialog] = useState<"password" | "email" | "delete" | null>(null)
  const set = (name: "password" | "email" | "delete") => (open: boolean) => setDialog(open ? name : null)

  return (
    <section aria-labelledby="security-title" className={card}>
      <div className="flex flex-col gap-1">
        <h2 id="security-title" className="type-h3">
          {t("security")}
        </h2>
        <p className="type-small font-normal text-muted-foreground">{t("securityDesc")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setDialog("password")}>
          {t("changePassword")}
        </Button>
        <Button variant="outline" onClick={() => setDialog("email")}>
          {t("changeEmail")}
        </Button>
      </div>
      <h3 className="type-h4">{t("devices")}</h3>
      <Devices />
      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <span className="type-small font-normal text-muted-foreground">{t("deleteDesc")}</span>
        <Button variant="destructive" onClick={() => setDialog("delete")}>
          {t("deleteAccount")}
        </Button>
      </div>
      <ChangePasswordDialog open={dialog === "password"} onOpenChange={set("password")} />
      <ChangeEmailDialog open={dialog === "email"} onOpenChange={set("email")} />
      <DeleteAccountDialog open={dialog === "delete"} onOpenChange={set("delete")} />
    </section>
  )
}
