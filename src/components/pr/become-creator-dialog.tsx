"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { useBecomeCreator } from "@/lib/creator"
import { withDemo } from "@/lib/demo-api"
import { creatorHandle } from "@/lib/routes"
import { useAppStore, useUser } from "@/lib/store"
import { useWaitText } from "@/lib/use-wait-text"

const schema = z.object({
  penName: z.string().trim().min(1, "penNameRequired").max(60, "penNameLong"),
  terms: z.boolean().refine((v) => v, "termsRequired"),
})
type Values = z.infer<typeof schema>

/** Demo: the account gets the CREATOR role on this device (and a profile name when the pen name differs). */
async function becomeCreatorDemo(penName: string) {
  await withDemo(() => undefined)
  const s = useAppStore.getState()
  const u = s.user
  if (!u) return
  const roles = [...new Set([...(u.roles ?? ["READER"]), "CREATOR"])]
  s.login({ ...u, roles })
  const account = s.accounts.find((a) => a.email.toLowerCase() === u.email.toLowerCase())
  if (account) s.addAccount({ ...account, roles })
  const name = penName.trim()
  if (name !== u.name) {
    s.setProfile({ name, location: s.profile?.location ?? "", bio: s.profile?.bio ?? "", handle: creatorHandle(u.name) })
  }
}

/**
 * Accept the Creator terms and choose a pen name. Real API: POST /creator (then the session refreshes for the
 * CREATOR role); demo: the role is added on this device. Calls `onDone` once the account is a creator.
 */
export function BecomeCreatorDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone?: () => void }) {
  const t = useTranslations("creator")
  const ts = useTranslations("states")
  const tauth = useTranslations("auth")
  const waitText = useWaitText()
  const user = useUser()
  const become = useBecomeCreator()
  const [demoPending, setDemoPending] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { penName: user?.name ?? "", terms: false },
  })
  const errors = form.formState.errors

  function done() {
    toast.success(t("becameCreator"))
    onOpenChange(false)
    onDone?.()
  }

  async function submit(values: Values) {
    if (DEMO_MODE) {
      setDemoPending(true)
      try {
        await becomeCreatorDemo(values.penName)
        done()
      } catch {
        toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
      } finally {
        setDemoPending(false)
      }
      return
    }
    become.mutate(values.penName, {
      onSuccess: done,
      onError: (error) => {
        const fields = fieldErrors(error)
        if (fields.penName) return form.setError("penName", { message: fields.penName === "required" ? "penNameRequired" : "penNameLong" })
        if (fields.acceptTerms) return form.setError("terms", { message: "termsRequired" })
        const wait = retryAfterSeconds(error)
        if (wait !== undefined) toast.error(tauth("tooManyTitle"), { description: waitText(wait), duration: 5000 })
        else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-40px)] overflow-y-auto">
        <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="type-h3">{t("becomeTitle")}</DialogTitle>
            <DialogDescription>{t("becomeDesc")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pen-name">{t("penName")}</Label>
            <Input
              id="pen-name"
              autoComplete="nickname"
              aria-invalid={!!errors.penName}
              aria-describedby={errors.penName ? "pen-name-error" : "pen-name-hint"}
              {...form.register("penName")}
            />
            {errors.penName ? (
              <p id="pen-name-error" className="text-[13px] leading-[18px] text-destructive">
                {t(errors.penName.message as "penNameRequired")}
              </p>
            ) : (
              <p id="pen-name-hint" className="text-xs leading-4 text-muted-foreground">
                {t("penNameHint")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3">
              <Controller
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <Checkbox
                    id="creator-terms"
                    className="mt-0.5"
                    checked={field.value}
                    aria-invalid={!!errors.terms}
                    aria-describedby={errors.terms ? "creator-terms-error" : undefined}
                    onCheckedChange={(c) => field.onChange(c === true)}
                  />
                )}
              />
              <Label htmlFor="creator-terms" className="block leading-5 font-normal">
                {t("terms")}{" "}
                <Link href="/legal/creator" className="rounded-sm text-brand-ink underline underline-offset-2">
                  {t("termsLink")}
                </Link>
              </Label>
            </div>
            {errors.terms ? (
              <p id="creator-terms-error" className="text-[13px] leading-[18px] text-destructive">
                {t(errors.terms.message as "termsRequired")}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="brand" loading={become.isPending || demoPending}>
              {t("becomeSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
