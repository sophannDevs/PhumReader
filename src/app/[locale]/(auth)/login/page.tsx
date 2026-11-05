import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { demoData } from "@/data"
import type { Locale } from "@/i18n/routing"

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params
  return { title: demoData.loginPageStrings[locale as Locale].login }
}

// Placeholder: the real form (log in, sign up, verify, forgot) arrives in T32-T35.
export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params
  setRequestLocale(locale)
  const strings = demoData.loginPageStrings[locale as Locale]
  return (
    <div lang={locale} className="flex flex-col items-center gap-1 text-center">
      <h1 className="type-h2">{strings.loginTitle}</h1>
      <p className="type-body text-muted-foreground">{strings.loginSub}</p>
    </div>
  )
}
