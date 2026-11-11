import { LoginRedirect } from "@/components/auth/login-redirect"

// V1 route: now a step of /login (?mode=signup), query string kept.
export default function SignupPage({ params, searchParams }: PageProps<"/[locale]/signup">) {
  return <LoginRedirect params={params} searchParams={searchParams} mode="signup" />
}
