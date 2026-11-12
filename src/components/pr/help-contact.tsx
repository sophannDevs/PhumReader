"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { CoinsIcon, ShieldIcon } from "lucide-react"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { ClockIcon } from "@/components/animate-ui/icons/clock"
import { MailIcon } from "@/components/animate-ui/icons/mail"
import { MessageSquareIcon } from "@/components/animate-ui/icons/message-square"
import { PlusIcon } from "@/components/animate-ui/icons/plus"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { SuccessBurst } from "@/components/pr/particle-burst"
import { NativeSelect } from "@/components/pr/settings-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { createTicket } from "@/lib/api/help"
import { withDemo } from "@/lib/demo-api"
import { localDigits } from "@/lib/format"
import { useAppStore, useHydrated } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

export const CONTACT_TOPICS = ["payment", "account", "reading", "creator", "report", "other"] as const
const MSG_MAX = 1000
const MAX_FILE = 5 * 1024 * 1024

const contactSchema = z
  .object({
    topic: z.string().min(1, "topicError"),
    email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "emailError"),
    order: z.string(),
    msg: z.string().refine((v) => v.trim().length >= 20, "messageError"),
  })
  .superRefine((v, ctx) => {
    const order = v.order.trim()
    if (v.topic === "payment" && order && !/^TW-\d{8}$/i.test(order)) {
      ctx.addIssue({ code: "custom", path: ["order"], message: "orderError" })
    }
  })
type ContactValues = z.infer<typeof contactSchema>

const label = "text-sm leading-5 font-medium"
const hint = "text-[13px] leading-[18px] text-muted-foreground"
const error = "text-[13px] leading-[18px] font-medium text-destructive"

function Required() {
  return (
    <span aria-hidden className="text-destructive">
      {" *"}
    </span>
  )
}

/**
 * Help center "Contact us" (spec §19, prototype Help): topic, email, order number (payments only, TW-12345678),
 * message (20+ characters, counter), screenshots (PNG or JPG up to 5 MB, kept in the browser), and a ticket number
 * T-xxxxx after sending. A receipt's "Get help" fills it in through the store's `helpPrefill` (read once, then
 * cleared), and /help#contact scrolls here with the topic focused. Demo mode simulates sending; real mode (V21-07) POSTs
 * /help/tickets, which saves the ticket and emails it to the support address (screenshots stay in the browser).
 */
export function HelpContact() {
  const t = useTranslations("help.contact")
  const locale = useLocale()
  const hydrated = useHydrated()
  const [files, setFiles] = useState<File[]>([])
  const [sent, setSent] = useState<{ ticket: string; email: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const sentHeading = useRef<HTMLHeadingElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { topic: "", email: "", order: "", msg: "" },
  })
  const { errors, isSubmitted } = form.formState
  const [topic, order, msg] = useWatch({ control: form.control, name: ["topic", "order", "msg"] })

  // Signed in: the account's email. From a receipt: topic, order number and message (then the hand-off is cleared).
  useEffect(() => {
    if (!hydrated) return
    const store = useAppStore.getState()
    if (store.user?.email && !form.getValues("email")) form.setValue("email", store.user.email)
    const prefill = store.helpPrefill
    if (prefill) {
      form.setValue("topic", prefill.topic || "")
      form.setValue("order", (prefill.order || "").toUpperCase())
      form.setValue("msg", (prefill.msg || "").slice(0, MSG_MAX))
      store.setHelpPrefill(null)
    }
    if (prefill || window.location.hash === "#contact") {
      const select = document.getElementById("ct-topic")
      sectionRef.current?.scrollIntoView({ block: "start" })
      select?.focus({ preventScroll: true })
    }
  }, [hydrated, form])

  const send = useMutation({
    mutationFn: async () => {
      if (DEMO_MODE) return withDemo(() => ({ ticket: `T-${58213 + Math.floor(Math.random() * 900)}` }), { delay: 900 })
      // Real mode (V21-07): the API saves the ticket and emails it to the support address.
      const v = form.getValues()
      return { ticket: await createTicket({ topic: v.topic, email: v.email.trim(), order: v.order, message: v.msg.trim(), locale }) }
    },
    onSuccess: ({ ticket }) => setSent({ ticket, email: form.getValues("email").trim() }),
    onError: () => toast.error(t("sendFailed")),
  })

  useEffect(() => {
    if (sent) sentHeading.current?.focus()
  }, [sent])

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? [])
    const ok = picked.filter((f) => (f.type === "image/png" || f.type === "image/jpeg") && f.size <= MAX_FILE)
    if (ok.length < picked.length) toast.error(t("attachBad"))
    if (ok.length) setFiles((prev) => [...prev, ...ok])
    if (fileInput.current) fileInput.current.value = ""
  }

  function again() {
    form.reset({ topic: "", email: form.getValues("email"), order: "", msg: "" })
    setFiles([])
    setSent(null)
  }

  const described = (field: keyof ContactValues, hintId?: string) =>
    errors[field] ? `ct-${field}-error` : hintId

  return (
    <Effect asChild fade slide={{ direction: "up", offset: 10 }} inView>
      <aside className="flex min-w-0 flex-col gap-4">
        <section
          ref={sectionRef}
          id="contact"
          aria-labelledby="ct-title"
          className="min-w-0 scroll-mt-20 rounded-card border bg-card shadow-xs"
        >
          {sent ? (
            <div className="flex flex-col items-start gap-2.5 p-5 max-md:p-4" role="status">
              <SuccessBurst radius={32}>
                <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckIcon className="size-5" />
                </span>
              </SuccessBurst>
              <h2 id="ct-title" ref={sentHeading} tabIndex={-1} className="type-h3 outline-none">
                {t("sentTitle")}
              </h2>
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                {t.rich("sentBody", {
                  email: sent.email,
                  ticket: sent.ticket,
                  b: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                })}
              </p>
              <Button variant="outline" size="sm" onClick={again}>
                {t("again")}
              </Button>
            </div>
          ) : (
            <form noValidate className="flex flex-col gap-3.5 p-5 max-md:p-4" onSubmit={form.handleSubmit(() => send.mutate())}>
              <div className="flex flex-col gap-1">
                <h2 id="ct-title" className="type-h3">
                  {t("title")}
                </h2>
                <p className={hint}>{t("intro")}</p>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="ct-topic" className={label}>
                  {t("topic")}
                  <Required />
                </label>
                <Controller
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <NativeSelect
                      id="ct-topic"
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      aria-required
                      aria-invalid={!!errors.topic}
                      aria-describedby={described("topic")}
                      className={cn(errors.topic && "border-destructive")}
                    >
                      <option value="">{t("chooseTopic")}</option>
                      {CONTACT_TOPICS.map((k) => (
                        <option key={k} value={k}>
                          {t(`topics.${k}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                />
                {errors.topic ? (
                  <p id="ct-topic-error" className={error}>
                    {t("topicError")}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="ct-email" className={label}>
                  {t("email")}
                  <Required />
                </label>
                <Input
                  id="ct-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-required
                  aria-invalid={!!errors.email}
                  aria-describedby={described("email")}
                  {...form.register("email")}
                />
                {errors.email ? (
                  <p id="ct-email-error" className={error}>
                    {t("emailError")}
                  </p>
                ) : null}
              </div>

              {topic === "payment" ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor="ct-order" className={label}>
                    {t("order")}
                  </label>
                  <Input
                    id="ct-order"
                    value={order}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t("orderPh")}
                    className="placeholder:text-[#a1a1aa]"
                    aria-invalid={!!errors.order}
                    aria-describedby={described("order", "ct-order-hint")}
                    onChange={(e) =>
                      form.setValue("order", e.target.value.toUpperCase().slice(0, 11), { shouldValidate: isSubmitted })
                    }
                  />
                  {errors.order ? (
                    <p id="ct-order-error" className={error}>
                      {t("orderError")}
                    </p>
                  ) : (
                    <p id="ct-order-hint" className={hint}>
                      {t("orderHint")}
                    </p>
                  )}
                </div>
              ) : null}

              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="ct-msg" className={label}>
                  {t("message")}
                  <Required />
                </label>
                <Textarea
                  id="ct-msg"
                  rows={5}
                  maxLength={MSG_MAX}
                  placeholder={t("messagePh")}
                  className="placeholder:text-[#a1a1aa]"
                  aria-required
                  aria-invalid={!!errors.msg}
                  aria-describedby={described("msg", "ct-msg-hint")}
                  {...form.register("msg")}
                />
                <div className="flex items-center justify-between gap-3">
                  {errors.msg ? (
                    <p id="ct-msg-error" className={error}>
                      {t("messageError")}
                    </p>
                  ) : (
                    <p id="ct-msg-hint" className={hint}>
                      {t("messageHint")}
                    </p>
                  )}
                  <span className="shrink-0 text-xs leading-4 text-muted-foreground tabular-nums">
                    {localDigits(`${msg.length}/${MSG_MAX}`, locale)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => addFiles(e.target.files)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <PlusIcon className="size-3.5" />
                  {files.length ? t("attached", { count: files.length }) : t("attach")}
                </Button>
                <span className="text-xs leading-4 text-muted-foreground">{t("attachHint")}</span>
              </div>

              <Button type="submit" variant="brand" loading={send.isPending} className="w-full">
                {t("send")}
              </Button>
            </form>
          )}
        </section>

        <OtherWays />
      </aside>
    </Effect>
  )
}

/** "Other ways to reach us": placeholders for the support channels, and the two policies people ask about. */
function OtherWays() {
  const t = useTranslations("help.other")
  const row = "flex items-center gap-2 text-[13px] leading-[18px]"
  const link =
    "flex items-center gap-2 self-start rounded-sm text-[13px] leading-[18px] font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  return (
    <section aria-labelledby="ow-title" className="flex flex-col gap-2.5 rounded-card border bg-card p-5 shadow-xs max-md:p-4">
      <h2 id="ow-title" className="type-h4">
        {t("title")}
      </h2>
      <p className={row}>
        <MailIcon className="size-4 shrink-0" aria-hidden />
        {t("email")}
      </p>
      <p className={row}>
        <MessageSquareIcon className="size-4 shrink-0" aria-hidden />
        {t("telegram")}
      </p>
      <p className={row}>
        <ClockIcon className="size-4 shrink-0" aria-hidden />
        {t("hours")}
      </p>
      <hr className="my-1 border-border" />
      <Link href="/legal/community" className={link}>
        <ShieldIcon className="size-4 shrink-0" aria-hidden />
        {t("community")}
      </Link>
      <Link href="/legal/refund" className={link}>
        <CoinsIcon className="size-4 shrink-0" aria-hidden />
        {t("refunds")}
      </Link>
    </section>
  )
}
