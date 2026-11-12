"use client"

import { AnimateIcon } from "@animate-ui/react/icons"
import { ArrowLeftIcon } from "@/components/animate-ui/icons/arrow-left"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { useTranslations } from "@/i18n/translations"
import { passwordChecks } from "@/components/auth/auth-schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Building blocks of the V2.1 Log in / Sign up card (design/prototype-src/Auth/page.css): 44 px inputs with a
 * 10 px radius, a 46 px round green submit, text links in brand ink, the strength meter and the rules.
 */

/** `.au-in`: 44 px, 10 px radius, 15 px text. */
export const authInput = "h-11 rounded-[10px] text-[15px] placeholder:text-[#a1a1aa]"

/** `.au-link`: underlined brand-ink text button. */
export const authLink =
  "rounded-[4px] text-[13px] font-semibold text-brand-ink underline underline-offset-[3px] outline-none hover:text-[#03632f] dark:hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"

export function AuthHead({ title, sub, icon }: { title: string; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {icon ? (
        <span
          aria-hidden
          className="mb-1 inline-flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-ink"
        >
          {icon}
        </span>
      ) : null}
      <h1 id="auth-title" className="text-2xl leading-[30px] font-bold tracking-[-0.02em] max-md:text-[22px] max-md:leading-7">
        {title}
      </h1>
      {sub ? <p className="text-sm leading-[21px] text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export function FieldError({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("text-[13px] leading-[18px] font-medium text-destructive", className)}>
      {children}
    </p>
  )
}

export function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[13px] leading-[18px] text-muted-foreground", className)}>{children}</p>
}

/** `.au-btn`: 46 px, fully round, green. */
export function SubmitButton({ loading, children }: { loading?: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="brand" size="lg" loading={loading} className="h-[46px] w-full rounded-full text-[15px] font-bold">
      {children}
    </Button>
  )
}

/** `.au-back`: "← Back to log in", "← Change email". */
export function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <AnimateIcon asChild animateOnHover><button
      type="button"
      onClick={onClick}
      className="-ml-1.5 inline-flex h-8 items-center gap-1.5 self-start rounded-lg pr-2.5 pl-1.5 text-[13px] font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeftIcon className="size-3.5" aria-hidden />
      {children}
    </button></AnimateIcon>
  )
}

/** `.au-note`: the grey demo / help note at the bottom of a step. */
export function AuthNote({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-[10px] bg-muted px-3 py-2.5 text-xs leading-[17px] text-muted-foreground">{children}</div>
}

/** "──── OR ────" */
export function OrDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      <span aria-hidden className="h-px flex-1 bg-border" />
      {children}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  )
}

/**
 * Password input with a "Show" / "Hide" text button inside (`.au-pw`). `visible` is controlled so Sign up's
 * confirm field can follow the same toggle. `onCapsLock` reports the Caps Lock state on every key.
 */
export function PasswordField({
  visible,
  onVisibleChange,
  onCapsLock,
  className,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  onCapsLock?: (on: boolean) => void
  ref?: React.Ref<HTMLInputElement>
}) {
  const t = useTranslations("auth")
  const caps = (e: React.KeyboardEvent<HTMLInputElement>) => onCapsLock?.(e.getModifierState?.("CapsLock") ?? false)
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(authInput, "pr-16", className)}
        onKeyUp={caps}
        onKeyDown={caps}
        {...props}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-controls={props.id}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        onClick={() => onVisibleChange(!visible)}
        className="absolute top-1.5 right-1.5 h-8 rounded-lg px-2.5 text-xs font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {visible ? t("hide") : t("show")}
      </button>
    </div>
  )
}

const LEVELS = [
  { width: "0%", tone: "", label: "" },
  { width: "25%", tone: "weak", label: "weak" },
  { width: "50%", tone: "fair", label: "fair" },
  { width: "75%", tone: "fair", label: "fair" },
  { width: "100%", tone: "strong", label: "strong" },
] as const

/** `.au-meter` + `.au-rules`: Weak / Fair / Strong bar and the four live rules in two columns. */
export function PasswordMeter({ password, id }: { password: string; id: string }) {
  const t = useTranslations("auth")
  const checks = passwordChecks(password)
  const met = checks.filter(Boolean).length
  // Prototype: 0–1 rules = weak, 2–3 = fair, 4 = strong.
  const level = !password ? LEVELS[0] : met <= 1 ? LEVELS[1] : LEVELS[Math.min(met, 4)]
  return (
    <>
      <div className="flex items-center gap-2.5" aria-live="polite">
        <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className={cn(
              "block h-full rounded-full bg-track transition-[width] duration-200",
              level.tone === "weak" && "bg-destructive",
              level.tone === "fair" && "bg-[#f59e0b]",
              level.tone === "strong" && "bg-primary"
            )}
            style={{ width: level.width }}
          />
        </div>
        <span
          className={cn(
            "min-w-12 text-right text-xs font-bold text-muted-foreground",
            level.tone === "weak" && "text-[#b91c1c] dark:text-destructive-ink",
            level.tone === "fair" && "text-warning",
            level.tone === "strong" && "text-brand-ink"
          )}
        >
          {level.label ? t(level.label) : null}
          {level.label ? <span className="sr-only">, {t("strength", { count: met })}</span> : null}
        </span>
      </div>
      <ul id={id} className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((ok, i) => (
          <li key={i} data-met={ok} className={cn("flex items-center gap-1.5 text-xs leading-4", ok ? "text-brand-ink" : "text-muted-foreground")}>
            <span
              aria-hidden
              className={cn(
                "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                ok ? "border-primary bg-primary text-primary-foreground" : "border-border-hover text-transparent"
              )}
            >
              <CheckIcon className="size-2.5" strokeWidth={3} />
            </span>
            {t(`rule${i}` as "rule0")}
            <span className="sr-only">{ok ? t("ruleMet") : t("ruleUnmet")}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
