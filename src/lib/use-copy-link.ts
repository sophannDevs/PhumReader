"use client"

import { toast } from "sonner"
import { useTranslations } from "@/i18n/translations"

/**
 * Share buttons: copies a link and says so in a toast, "Link copied" (`toasts.linkCopied`, or `successKey`: a full
 * message key such as "profile.linkCopied") or "Couldn't copy the link" (`toasts.copyFailed`). The link is the current
 * address (`window.location.href`) unless `url` gives another one; it is read when the button is pressed. The returned
 * function takes no arguments, so it can be an onClick handler as it is.
 */
export function useCopyLink({ url, successKey = "toasts.linkCopied" }: { url?: () => string; successKey?: string } = {}) {
  const t = useTranslations()
  return async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url ? url() : window.location.href)
      toast.success(t(successKey))
    } catch {
      toast.error(t("toasts.copyFailed"))
    }
  }
}
