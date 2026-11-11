"use client"

import { useTranslations } from "@/i18n/translations"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { FaqItem } from "@/data"
import { useLocalize } from "@/lib/localize"

/** "Questions" (prototype Shop `.acc`): accordion from `coinsFaq`, the first item open. */
export function CoinsFaq({ items }: { items: FaqItem[] }) {
  const t = useTranslations("coins")
  const loc = useLocalize()
  return (
    <section aria-labelledby="faq-title" className="flex min-w-0 flex-col gap-3">
      <h2 id="faq-title" className="type-h3">
        {t("faqTitle")}
      </h2>
      <Accordion type="single" collapsible defaultValue="faq-0" className="rounded-card border bg-card px-4 shadow-xs">
        {items.map((raw, i) => {
          const f = loc.faq(i, raw)
          return (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="min-h-[52px] items-center py-3 font-medium hover:text-foreground hover:underline hover:underline-offset-4">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-3.5 text-sm leading-[21px] text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </section>
  )
}
