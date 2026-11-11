import { getTranslations as getNextIntlTranslations } from "next-intl/server"
import { withLocalDigits } from "./local-digits"

/**
 * next-intl's `getTranslations` for async server code (pages, layouts, `generateMetadata`), with Khmer digits for
 * numbers filled into Khmer messages (see local-digits.ts). Use this one instead of importing it from next-intl.
 */
export const getTranslations = (async (...args: Parameters<typeof getNextIntlTranslations>) =>
  withLocalDigits(await getNextIntlTranslations(...args))) as typeof getNextIntlTranslations
