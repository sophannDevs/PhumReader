"use client"

import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { useRouter } from "@/i18n/navigation"
import { firstName } from "@/lib/format"
import { useAppStore, useUser } from "@/lib/store"

/** "Welcome, <first name>" + "Taking you back…", then to `returnTo` (default Home) after 1.2 s. */
export function DoneView() {
  const t = useTranslations("auth")
  const router = useRouter()
  const user = useUser()

  useEffect(() => {
    const id = setTimeout(() => {
      const { returnTo, clearReturnTo } = useAppStore.getState()
      clearReturnTo()
      router.replace(returnTo ?? "/")
    }, 1200)
    return () => clearTimeout(id)
  }, [router])

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-live="polite">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-7" strokeWidth={3} />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="type-h2">{t("welcome", { name: firstName(user?.name ?? "") })}</h1>
        <p className="type-body text-muted-foreground">{t("taking")}</p>
      </div>
    </div>
  )
}
