import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Section = { h: string; p: string };

/** Terms of use and Privacy policy: numbered sections of placeholder text (A16) with a table of contents. */
export function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const t = useTranslations("legal");
  const sections = t.raw(`${kind}.sections`) as Section[];
  return (
    <div className="container flex max-w-3xl flex-col gap-6 py-8 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="type-h1">{t(`${kind}.title`)}</h1>
        <p className="type-small font-normal text-muted-foreground">
          {t("updated")}
        </p>
        <p className="type-lead">{t(`${kind}.intro`)}</p>
      </header>
      <Alert>
        <AlertDescription>{t("placeholderNote")}</AlertDescription>
      </Alert>
      <nav
        aria-label={t("toc")}
        className="rounded-card border bg-card p-4 shadow-xs"
      >
        <h2 className="mb-2 text-sm font-semibold">{t("toc")}</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {sections.map((s, i) => (
            <li key={s.h}>
              <a
                href={`#${kind}-${i + 1}`}
                className="rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {s.h}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section
          key={s.h}
          id={`${kind}-${i + 1}`}
          aria-labelledby={`${kind}-${i + 1}-title`}
          className="flex scroll-mt-20 flex-col gap-2"
        >
          <h2 id={`${kind}-${i + 1}-title`} className="type-h3">
            {i + 1}. {s.h}
          </h2>
          <p className="text-muted-foreground">{s.p}</p>
        </section>
      ))}
    </div>
  );
}
