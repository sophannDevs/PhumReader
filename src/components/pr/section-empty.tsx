"use client"

import { useTranslations } from "next-intl"
import { EmptyState } from "@/components/pr/empty-state"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"

/** Empty state for one Home section ("Nothing here yet" + a link). Keeps the section's height modest. */
export function SectionEmpty({ className }: { className?: string }) {
  const s = useTranslations("states")
  const t = useTranslations("home")
  return (
    <EmptyState
      title={s("emptyTitle")}
      className={className ?? "rounded-card border border-dashed py-10"}
      action={
        <Button asChild variant="outline">
          <Link href="/genres">{t("emptyLink")}</Link>
        </Button>
      }
    />
  )
}
