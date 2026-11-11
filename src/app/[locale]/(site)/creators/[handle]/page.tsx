import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { Suspense } from "react"
import { CreatorProfilePage, ProfileSkeleton } from "@/components/pr/creator-profile-page"
import { routing } from "@/i18n/routing"
import { DEMO_MODE } from "@/lib/api/config"
import { creatorNameByHandle, creatorNames } from "@/lib/creator-profiles"
import { creatorHandle } from "@/lib/routes"

// Every creator in the demo series has a profile (handle = slug of the name).
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => creatorNames().map((name) => ({ locale, handle: creatorHandle(name) })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/creators/[handle]">): Promise<Metadata> {
  const { locale, handle } = await params
  const t = await getTranslations({ locale, namespace: "profile" })
  const name = creatorNameByHandle(handle)
  return { title: name ? t("metaTitle", { name }) : t("metaOwn") }
}

async function Content({ params, searchParams }: PageProps<"/[locale]/creators/[handle]">) {
  const [{ locale, handle }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const name = creatorNameByHandle(handle) ?? null
  const ownerView = query.view === "owner"
  // Demo: unknown handles 404, except the owner view (a creator outside the demo data opens their own). Real API: the
  // page asks the API and shows the 404 page when there is no such creator.
  if (DEMO_MODE && !name && !ownerView) notFound()
  return <CreatorProfilePage handle={handle} name={name} ownerView={ownerView} />
}

// ?view=owner is read inside Suspense (Cache Components).
export default function Page(props: PageProps<"/[locale]/creators/[handle]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
