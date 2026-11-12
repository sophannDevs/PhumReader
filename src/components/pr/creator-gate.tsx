"use client"

import { AlertCircleIcon, LogInIcon, PenLineIcon, type LucideIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { BecomeCreatorDialog } from "@/components/pr/become-creator-dialog"
import { Eyebrow, StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Link, usePathname } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useCreator } from "@/lib/queries"
import { isCreator, useAppStore, useHydrated, useUser } from "@/lib/store"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * What every creator page needs first: a signed-in account (else Log in / Sign up) with the creator role (else the
 * "Become a creator" invitation and dialog). Demo: the role comes from the account (creator@phumireader.app has it);
 * real API: from GET /creator/dashboard. Shows the page title above the waiting and denied states.
 */
export function CreatorGate({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  const t = useTranslations("creator")
  const ts = useTranslations("states")
  const user = useUser()
  const hydrated = useHydrated()
  const pathname = usePathname()
  const dashboard = useCreator()
  const [becoming, setBecoming] = useState(false)

  const shell = (body: React.ReactNode) => (
    <div className="container flex flex-col gap-6 pt-6 pb-16 md:pt-8">
      <div className="flex flex-col gap-1">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="type-h2">{title}</h1>
      </div>
      {body}
    </div>
  )
  const remember = () => useAppStore.getState().setReturnTo(`${pathname}${window.location.search}`)

  const notCreator = (
    <>
      <GateCard
        icon={PenLineIcon}
        title={t("notCreatorTitle")}
        text={t("notCreatorDesc")}
        actions={
          <>
            <Button variant="brand" size="lg" onClick={() => setBecoming(true)}>
              {t("becomeStart")}
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/creators/join">{t("howItWorks")}</Link>
            </Button>
          </>
        }
      />
      <BecomeCreatorDialog open={becoming} onOpenChange={setBecoming} />
    </>
  )

  if (!hydrated) return shell(<GateSkeleton />)
  if (!user) {
    return shell(
      <GateCard
        icon={LogInIcon}
        title={t("loginTitle")}
        text={t("loginDesc")}
        actions={
          <>
            <Button asChild variant="brand" size="lg">
              <Link href="/login" onClick={remember}>
                {t("login")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login?mode=signup" onClick={remember}>
                {t("signup")}
              </Link>
            </Button>
          </>
        }
      />
    )
  }
  if (DEMO_MODE) return isCreator(user) ? <>{children}</> : shell(notCreator)
  if (dashboard.isPending) return shell(<GateSkeleton />)
  if (dashboard.isError) {
    return shell(
      <StateBox
        icon={AlertCircleIcon}
        tone="bad"
        title={ts("errorTitle")}
        text={ts("errorDescription")}
        action={
          <Button variant="outline" size="sm" className="mt-1" onClick={() => void dashboard.refetch()}>
            {ts("retry")}
          </Button>
        }
      />
    )
  }
  if (!dashboard.data.isCreator) return shell(notCreator)
  return <>{children}</>
}

/** Prototype `.cr-start` look: soft green fade, round icon, title, text and buttons. */
function GateCard({ icon: Icon, title, text, actions }: { icon: LucideIcon; title: string; text: string; actions: React.ReactNode }) {
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 10 }}>
      <section className="flex flex-col items-center gap-3 rounded-[16px] border bg-background bg-[image:linear-gradient(135deg,#effcf4,#ffffff_70%)] px-5 py-12 text-center shadow-xs md:rounded-hero md:px-8 md:py-14">
        <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <Icon className="size-5" />
        </span>
        <h2 className="type-h3">{title}</h2>
        <p className="max-w-md text-sm leading-[21px] text-muted-foreground">{text}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
      </section>
    </Effect>
  )
}

function GateSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-card max-md:h-[92px]" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
    </div>
  )
}
