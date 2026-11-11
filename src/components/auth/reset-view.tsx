"use client"

import { LinkIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { AuthHead, BackButton } from "@/components/auth/auth-ui"
import { NewPasswordForm } from "@/components/auth/new-password-form"
import { Button } from "@/components/ui/button"
import { Link, useRouter } from "@/i18n/navigation"
import { resetPassword } from "@/lib/session"
import { useAppStore } from "@/lib/store"

/**
 * /reset?token=…, opened from the emailed link (real API, plan P4-09): choose a new password, then Log in with
 * the "Password updated" message (/login?reset=done). A used or expired link (30 minutes, once) offers a new one.
 */
export function ResetView() {
  const t = useTranslations("auth")
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""
  const [invalid, setInvalid] = useState(!token)

  if (invalid) {
    return (
      <div className="flex flex-col gap-[18px]" role="status">
        <BackButton onClick={() => router.push("/login")}>{t("backLogin")}</BackButton>
        <AuthHead icon={<LinkIcon className="size-5" />} title={t("resetInvalidTitle")} sub={t("resetInvalidSub")} />
        <Button asChild variant="brand" size="lg" className="h-[46px] w-full rounded-full text-[15px] font-bold">
          <Link href="/login?mode=forgot">{t("newLink")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <AuthHead title={t("resetTitle")} sub={t("resetSub")} />
      <NewPasswordForm
        save={(password) => resetPassword(token, password)}
        onSaved={() => {
          // Every device was signed out, this one too.
          useAppStore.getState().logout()
          router.replace("/login?reset=done")
        }}
        onInvalidToken={() => setInvalid(true)}
      />
    </div>
  )
}
