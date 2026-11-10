import { LegalRedirect } from "@/components/pr/legal-redirect"

// V1 route: now /legal/privacy, query string kept.
export default function PrivacyPage({ params, searchParams }: PageProps<"/[locale]/privacy">) {
  return <LegalRedirect params={params} searchParams={searchParams} doc="privacy" />
}
