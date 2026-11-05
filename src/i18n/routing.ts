import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "km"],
  defaultLocale: "en",
  // English URLs match design/spec.md (/series/x); Khmer lives under /km/...
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
