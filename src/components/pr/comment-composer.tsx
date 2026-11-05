"use client"

import { useId } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** "Add a comment" card: textarea, 0/500 counter and a dark Post button. */
export function CommentComposer({
  value,
  onChange,
  onSubmit,
  max = 500,
  textareaRef,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  max?: number
  textareaRef?: React.Ref<HTMLTextAreaElement>
  className?: string
}) {
  const t = useTranslations("comments")
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <form
      className={cn("flex flex-col gap-3 rounded-card border bg-card p-5 shadow-xs", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSubmit()
      }}
    >
      <Label htmlFor={id} className="text-sm font-medium">
        {t("add")}
      </Label>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        maxLength={max}
        placeholder={t("placeholder")}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <p id={hintId} className="type-caption font-normal text-muted-foreground">
          <span className="tabular-nums">
            {value.length}/{max}
          </span>{" "}
          · {t("hint")}
        </p>
        <Button type="submit" disabled={!value.trim()}>
          {t("post")}
        </Button>
      </div>
    </form>
  )
}
