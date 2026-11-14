"use client"

import { EyeIcon } from "@/components/animate-ui/icons/eye"
import { EyeOffIcon } from "@/components/animate-ui/icons/eye-off"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Password field with a show / hide eye button (`aria-pressed`). */
export function PasswordInput({
  ref,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & { ref?: React.Ref<HTMLInputElement> }) {
  const t = useTranslations("auth")
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className="pr-11" {...props} />
      <Button animateIcon
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute top-0.5 right-0.5"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  )
}
