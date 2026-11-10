import { LoginRedirect } from "@/components/auth/login-redirect"

// V1 route: now a step of /login (?mode=verify), query string kept.
export default function VerifyPage({ params, searchParams }: PageProps<"/[locale]/verify">) {
  return <LoginRedirect params={params} searchParams={searchParams} mode="verify" />
}
