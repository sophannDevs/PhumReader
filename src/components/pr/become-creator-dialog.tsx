"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "@/i18n/navigation"
import { fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { useBecomeCreator } from "@/lib/creator"
import { useUser } from "@/lib/store"
import { useWaitText } from "@/lib/use-wait-text"

const schema = z.object({
  penName: z.string().trim().min(1, "penNameRequired").max(60, "penNameLong"),
  terms: z.boolean().refine((v) => v, "termsRequired"),
})
type Values = z.infer<typeof schema>

/** Accept the Creator terms and choose a pen name (real API). Calls `onDone` once the account is a creator. */
export function BecomeCreatorDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone?: () => void }) {
  const t = useTranslations("creatorSeries")
  const ts = useTranslations("states")
  const tauth = useTranslations("auth")
  const waitText = useWaitText()
  const user = useUser()
  const become = useBecomeCreator()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { penName: user?.name ?? "", terms: false },
  })
  const errors = form.formState.errors

  function submit(values: Values) {
    become.mutate(values.penName, {
      onSuccess: () => {
        toast.success(t("becameCreator"))
        onOpenChange(false)
        onDone?.()
      },
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
      <DialogContent>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("becomeTitle")}</DialogTitle>
            <DialogDescription>{t("becomeDesc")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pen-name">{t("penName")}</Label>
            <Input
              id="pen-name"
              autoComplete="nickname"
              aria-invalid={!!errors.penName}
              aria-describedby={errors.penName ? "pen-name-error" : "pen-name-hint"}
              {...form.register("penName")}
            />
            {errors.penName ? (
              <p id="pen-name-error" className="text-[13px] text-destructive">
                {t(errors.penName.message as "penNameRequired")}
              </p>
            ) : (
              <p id="pen-name-hint" className="type-small font-normal text-muted-foreground">
                {t("penNameHint")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
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
              <Label htmlFor="creator-terms" className="leading-5 font-normal">
                {t("terms")}{" "}
                <Link href="/creator#guidelines" className="underline underline-offset-2">
                  {t("termsLink")}
                </Link>
              </Label>
            </div>
            {errors.terms ? (
              <p id="creator-terms-error" className="text-[13px] text-destructive">
                {t(errors.terms.message as "termsRequired")}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="brand" loading={become.isPending}>
              {t("becomeSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
