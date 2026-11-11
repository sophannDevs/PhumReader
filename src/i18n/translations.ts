import { useTranslations as useNextIntlTranslations } from "next-intl"
import { withLocalDigits } from "./local-digits"

/**
 * next-intl's `useTranslations`, with Khmer digits for numbers filled into Khmer messages (see local-digits.ts).
 * Use this one in client and server components instead of importing it from next-intl.
 */
export const useTranslations = ((namespace?: string) =>
  withLocalDigits(useNextIntlTranslations(namespace as never))) as typeof useNextIntlTranslations
