"use client"

import { BellIcon } from "@/components/animate-ui/icons/bell"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { HouseIcon as HomeIcon } from "@/components/animate-ui/icons/house"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { toast } from "sonner"
import { ErrorHelp, ErrorHero, StatusLink, errorActions } from "@/components/pr/error-page"
import { Button } from "@/components/ui/button"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useAppStore, useHydrated, useUser } from "@/lib/store"

/**
 * Scheduled maintenance (spec §9, screens 09-error-maintenance-*): the [MAINTENANCE START] / [MAINTENANCE END] window,
 * "Notify me when it's back" (guests go to Log in first and come back here), Go to Home, Help center · Service status.
 */
export function MaintenanceView() {
  const t = useTranslations("errors")
  const user = useUser()
  const hydrated = useHydrated()
  const pathname = usePathname()
  const router = useRouter()
  const [notifyOn, setNotifyOn] = useState(false)

  function notify() {
    if (!hydrated) return
    if (!user) {
      useAppStore.getState().setReturnTo(`${pathname}${window.location.search}`)
      router.push("/login")
      return
    }
    const next = !notifyOn
    setNotifyOn(next)
    toast.success(next ? t("maintenance.notifyToast") : t("maintenance.notifyOff"))
  }

  return (
    <ErrorHero kind="maintenance" title={t("maintenance.title")} body={t("maintenance.body")}>
      <dl className="m-0 grid grid-cols-1 overflow-hidden rounded-card border bg-background md:grid-cols-2">
        <div className="px-3.5 py-3">
          <dt className="text-xs leading-4 text-muted-foreground">{t("maintenance.started")}</dt>
          <dd className="mt-0.5 text-sm leading-5 font-semibold">{t("maintenance.start")}</dd>
        </div>
        <div className="border-t px-3.5 py-3 md:border-t-0 md:border-l">
          <dt className="text-xs leading-4 text-muted-foreground">{t("maintenance.backBy")}</dt>
          <dd className="mt-0.5 text-sm leading-5 font-semibold">{t("maintenance.end")}</dd>
        </div>
      </dl>
      <div className={errorActions}>
        <Button animateIcon variant="brand" size="lg" onClick={notify} aria-pressed={notifyOn}>
          {notifyOn ? <CheckIcon /> : <BellIcon />}
          {notifyOn ? t("maintenance.notifyOn") : t("maintenance.notify")}
        </Button>
        <Button animateIcon asChild variant="outline" size="lg">
          <Link href="/">
            <HomeIcon />
            {t("home")}
          </Link>
        </Button>
      </div>
      <ErrorHelp extra={<StatusLink />} />
    </ErrorHero>
  )
}
