import type { Metadata, Viewport } from "next";
import { Inter, Kantumruy_Pro, Noto_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "@/i18n/translations-server";
import "../globals.css";
import { loadMessages } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import { ServiceWorker } from "@/components/pr/service-worker";
import { Providers } from "@/lib/query";
import { cn } from "@/lib/utils";
import { ACCENT_BOOT_SCRIPT } from "@/lib/accent";

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

/** `cover` lets the phone tab bar use `env(safe-area-inset-bottom)` on notched devices. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: { default: t("siteName"), template: `%s · ${t("siteName")}` },
    description: t("tagline"),
    applicationName: t("siteName"),
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("siteName"),
      description: t("tagline"),
      locale: locale === "km" ? "km_KH" : "en_US",
    },
    twitter: { card: "summary", title: t("siteName"), description: t("tagline") },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Explicit locale + messages: the provider then needs no request-time lookup,
  // which keeps the route prerenderable under Cache Components.
  const messages = await loadMessages(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("h-full antialiased font-sans", inter.variable, kantumruy.variable, notoSerif.variable)}
      style={{ colorScheme: "light" }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
          <ServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
