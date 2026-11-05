import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomePlaceholder />;
}

function HomePlaceholder() {
  const t = useTranslations("common");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-3xl font-semibold">{t("siteName")}</h1>
      <p className="text-muted-foreground">{t("tagline")}</p>
    </main>
  );
}
