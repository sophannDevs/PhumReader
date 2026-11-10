import { LoginRedirect } from "@/components/auth/login-redirect"

// V1 route: now a step of /login (?mode=forgot), query string kept.
export default function ForgotPage({ params, searchParams }: PageProps<"/[locale]/forgot">) {
  return <LoginRedirect params={params} searchParams={searchParams} mode="forgot" />
}
