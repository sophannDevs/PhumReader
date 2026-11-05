"use client"

import { useTranslations } from "next-intl"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { FaqItem } from "@/data"

/** "Questions": accordion from `coinsFaq`, the first item open. */
export function CoinsFaq({ items }: { items: FaqItem[] }) {
  const t = useTranslations("coins")
  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-3">
      <h2 id="faq-title" className="type-h3">
        {t("faqTitle")}
      </h2>
      <Accordion
        type="single"
        collapsible
        defaultValue="faq-0"
        className="rounded-card border bg-card px-5 shadow-xs"
      >
        {items.map((f, i) => (
          <AccordionItem key={f.q} value={`faq-${i}`}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
