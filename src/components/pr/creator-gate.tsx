"use client"

import { LogInIcon, PenLineIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { BecomeCreatorDialog } from "@/components/pr/become-creator-dialog"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { SkeletonRow } from "@/components/pr/skeletons"
import { Button } from "@/components/ui/button"
import { Link, usePathname } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useCreator } from "@/lib/queries"
import { useAppStore, useUser } from "@/lib/store"

/**
 * What every creator page needs first: a signed-in account (else a Log in prompt) that is a creator
 * (else the "Become a creator" invitation). Shows the page title above the loading and error states.
 * The demo has no creator accounts, so there it only asks for the demo login.
 */
export function CreatorGate({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  const t = useTranslations("creatorSeries")
  const user = useUser()
  const pathname = usePathname()
  const dashboard = useCreator()
  const [becoming, setBecoming] = useState(false)

  const shell = (body: React.ReactNode) => (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-col gap-1">
        {eyebrow ? <p className="type-eyebrow">{eyebrow}</p> : null}
        <h1 className="type-h1">{title}</h1>
      </div>
      {body}
    </div>
  )

  if (!user) {
    return shell(
      <EmptyState
        icon={LogInIcon}
        title={t("loginTitle")}
        description={t("loginDesc")}
        className="py-16"
        action={
          <Button asChild variant="brand" size="lg">
            <Link href="/login" onClick={() => useAppStore.getState().setReturnTo(pathname)}>
              {t("login")}
            </Link>
          </Button>
        }
      />
    )
  }
  if (DEMO_MODE) return <>{children}</>
  if (dashboard.isPending) {
    return shell(
      <div className="flex flex-col gap-4 rounded-card border p-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonRow key={i} thumb="h-[52px] w-10" />
        ))}
      </div>
    )
  }
  if (dashboard.isError) return shell(<ErrorState onRetry={() => void dashboard.refetch()} />)
  if (!dashboard.data.isCreator) {
    return shell(
      <>
        <EmptyState
          icon={PenLineIcon}
          title={t("notCreatorTitle")}
          description={t("notCreatorDesc")}
          className="py-16"
          action={
            <Button variant="brand" size="lg" onClick={() => setBecoming(true)}>
              {t("becomeStart")}
            </Button>
          }
        />
        <BecomeCreatorDialog open={becoming} onOpenChange={setBecoming} />
      </>
    )
  }
  return <>{children}</>
}
