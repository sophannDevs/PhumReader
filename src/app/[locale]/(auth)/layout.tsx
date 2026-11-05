import { setRequestLocale } from "next-intl/server"
import { AuthSplitLayout } from "@/components/layout/auth-split-layout"

// No site header, footer or tab bar. T19 / T35 pass `returnTo` as `backHref`.
export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <AuthSplitLayout>{children}</AuthSplitLayout>
}
