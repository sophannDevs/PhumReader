import { LegalRedirect } from "@/components/pr/legal-redirect"

// V1 route: now /legal/terms, query string kept.
export default function TermsPage({ params, searchParams }: PageProps<"/[locale]/terms">) {
  return <LegalRedirect params={params} searchParams={searchParams} doc="terms" />
}
