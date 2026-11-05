import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "auth" })
  return { title: t("login") }
}

// Placeholder: the real form (log in, sign up, verify, forgot) arrives in T32-T35.
export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("auth")
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="type-h2">{t("loginTitle")}</h1>
      <p className="type-body text-muted-foreground">{t("loginSub")}</p>
    </div>
  )
}
