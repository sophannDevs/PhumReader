"use client"

import { CheckIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useState } from "react"
import { usePlaceName } from "@/components/auth/use-place-name"
import { useRouter } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { firstName } from "@/lib/format"
import { useAppStore } from "@/lib/store"

/**
 * "Welcome back, Sokha" / "Welcome to PhumiReader, Sokha" + "Taking you back to …", then after 1.4 s:
 * existing accounts go to `returnTo` (default Home); new accounts go to /welcome (in the language they chose),
 * which returns to `welcomeNext`.
 */
export function DoneView({ name, isNew, ui }: { name: string; isNew: boolean; ui: Locale | null }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const placeName = usePlaceName()
  // Read once: the place stays the same while the step is shown.
  const [place] = useState(() => placeName(useAppStore.getState().returnTo))

  useEffect(() => {
    const id = setTimeout(() => {
      const { returnTo, clearReturnTo } = useAppStore.getState()
      clearReturnTo()
      if (isNew) router.replace("/welcome", ui ? { locale: ui } : undefined)
      else router.replace(returnTo ?? "/")
    }, 1400)
    return () => clearTimeout(id)
  }, [router, isNew, ui])

  return (
    <div className="flex flex-col items-center gap-[18px] py-6 text-center" role="status">
      <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-[22px]" strokeWidth={2.5} />
      </span>
      <h1 id="auth-title" className="text-2xl leading-[30px] font-bold tracking-[-0.02em] max-md:text-[22px] max-md:leading-7">
        {t(isNew ? "helloNew" : "welcomeBack", { name: firstName(name) || name })}
      </h1>
      <p className="text-sm leading-[21px] text-muted-foreground">{t("takingTo", { place })}</p>
      <Loader2Icon aria-hidden className="mt-1.5 size-4 animate-spin text-muted-foreground" />
    </div>
  )
}
