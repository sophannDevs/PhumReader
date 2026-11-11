import { setRequestLocale } from "next-intl/server"
import { AdminShell } from "@/components/layout/admin-shell"

// Admin (spec §22, screens 22-*): its own dark top bar and side menu, no site header, footer or phone tab bar.
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <AdminShell>{children}</AdminShell>
}
