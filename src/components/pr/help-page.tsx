import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Faq = { q: string; a: string };

/** Help center: common questions and a contact section (placeholder text, A16). */
export function HelpPage() {
  const t = useTranslations("legal");
  const faq = t.raw("help.faq") as Faq[];
  return (
    <div className="container flex max-w-3xl flex-col gap-6 py-8 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="type-h1">{t("help.title")}</h1>
        <p className="type-lead">{t("help.intro")}</p>
      </header>
      <Alert>
        <AlertDescription>{t("placeholderNote")}</AlertDescription>
      </Alert>
      <section aria-labelledby="help-faq" className="flex flex-col gap-3">
        <h2 id="help-faq" className="type-h3">
          {t("help.faqTitle")}
        </h2>
        <Accordion
          type="single"
          collapsible
          defaultValue="faq-0"
          className="rounded-card border bg-card px-5 shadow-xs"
        >
          {faq.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <section
        id="contact"
        aria-labelledby="help-contact"
        className="flex scroll-mt-20 flex-col gap-2 rounded-card border bg-card p-5 shadow-xs"
      >
        <h2 id="help-contact" className="type-h3 flex items-center gap-2">
          <MailIcon className="size-5" aria-hidden />
          {t("help.contactTitle")}
        </h2>
        <p className="text-muted-foreground">{t("help.contactBody")}</p>
      </section>
    </div>
  );
}
