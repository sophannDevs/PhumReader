import type { Metadata } from "next";
import { Inter, Kantumruy_Pro, Noto_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Self-hosted by next/font. Latin falls to Inter, Khmer falls to Kantumruy Pro
// (see --font-sans in globals.css). Noto Serif is only for the novel reader.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const kantumruy = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-khmer",
  display: "swap",
});
const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("siteName"), description: t("tagline") };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={cn("h-full antialiased font-sans", inter.variable, kantumruy.variable, notoSerif.variable)}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
