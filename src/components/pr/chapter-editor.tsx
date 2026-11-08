"use client"

import { ArrowDownIcon, ArrowUpIcon, BoldIcon, HeadingIcon, ItalicIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { stripMarks } from "@/lib/inline-marks"
import { cn } from "@/lib/utils"

export type BlockType = "paragraph" | "heading" | "quote" | "scene-break"
/** One block of chapter text; the text may carry **bold** and *italic* marks. */
export type EditorBlock = { id: string; type: BlockType; text: string }

let counter = 0
export const newBlock = (type: BlockType = "paragraph", text = ""): EditorBlock => ({ id: `block-${++counter}`, type, text })

/** Words as the API counts them (split on spaces), without the marks. */
export function countWords(blocks: EditorBlock[]): number {
  return blocks.reduce((sum, b) => {
    if (b.type === "scene-break") return sum
    const text = stripMarks(b.text).trim()
    return sum + (text ? text.split(/\s+/).length : 0)
  }, 0)
}

/** The chapter has something to read (a scene break alone is not a chapter). */
export const hasText = (blocks: EditorBlock[]) => blocks.some((b) => b.type !== "scene-break" && b.text.trim() !== "")

/**
 * A small block editor for a chapter: paragraphs, headings and quotes with bold and italic, scene
 * breaks, reorder and delete, and a live word count. Marks are written as **bold** and *italic*,
 * so what is stored is plain text that readers render safely.
 */
export function ChapterEditor({ blocks, onChange, error }: { blocks: EditorBlock[]; onChange: (blocks: EditorBlock[]) => void; error?: string }) {
  const t = useTranslations("episodeForm")
  const fields = useRef(new Map<string, HTMLTextAreaElement>())
  const words = countWords(blocks)

  const update = (id: string, change: Partial<EditorBlock>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...change } : b)))
  const move = (index: number, to: number) => {
    if (to < 0 || to >= blocks.length) return
    const next = [...blocks]
    next.splice(to, 0, ...next.splice(index, 1))
    onChange(next)
  }
  const add = (type: BlockType) => {
    const block = newBlock(type)
    onChange([...blocks, block])
    if (type !== "scene-break") requestAnimationFrame(() => fields.current.get(block.id)?.focus())
  }

  /** Wraps the selection in a mark, or takes the mark off when it is already there. */
  function mark(block: EditorBlock, marker: "**" | "*") {
    const field = fields.current.get(block.id)
    if (!field) return
    const { selectionStart: from, selectionEnd: to, value } = field
    const before = value.slice(0, from)
    const selected = value.slice(from, to)
    const after = value.slice(to)
    let text: string
    let start: number
    let end: number
    if (before.endsWith(marker) && after.startsWith(marker) && !(marker === "*" && before.endsWith("**") && after.startsWith("**"))) {
      text = before.slice(0, -marker.length) + selected + after.slice(marker.length)
      start = from - marker.length
      end = to - marker.length
    } else {
      text = before + marker + selected + marker + after
      start = from + marker.length
      end = to + marker.length
    }
    update(block.id, { text })
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(start, end)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3" aria-label={t("chapterBlocks")}>
        {blocks.map((block, index) => {
          const n = index + 1
          const isBreak = block.type === "scene-break"
          return (
            <li key={block.id} className="flex flex-col gap-2 rounded-card border bg-card p-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {isBreak ? (
                  <span className="type-small font-medium">{t("blockSceneBreak")}</span>
                ) : (
                  <>
                    <select
                      aria-label={t("blockType", { n })}
                      value={block.type}
                      onChange={(e) => update(block.id, { type: e.target.value as BlockType })}
                      className="h-8 rounded-control border border-input bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="paragraph">{t("blockParagraph")}</option>
                      <option value="heading">{t("blockHeading")}</option>
                      <option value="quote">{t("blockQuote")}</option>
                    </select>
                    <Button type="button" variant="outline" size="icon-sm" aria-label={t("bold", { n })} title={t("boldShortcut")} onClick={() => mark(block, "**")}>
                      <BoldIcon />
                    </Button>
                    <Button type="button" variant="outline" size="icon-sm" aria-label={t("italic", { n })} title={t("italicShortcut")} onClick={() => mark(block, "*")}>
                      <ItalicIcon />
                    </Button>
                  </>
                )}
                <div className="ml-auto flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t("blockUp", { n })}>
                    <ArrowUpIcon />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === blocks.length - 1} onClick={() => move(index, index + 1)} aria-label={t("blockDown", { n })}>
                    <ArrowDownIcon />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(blocks.filter((b) => b.id !== block.id))} aria-label={t("blockRemove", { n })}>
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
              {isBreak ? (
                <p aria-hidden className="py-1 text-center tracking-[1em] text-muted-foreground">
                  * * *
                </p>
              ) : (
                <Textarea
                  ref={(el) => {
                    if (el) fields.current.set(block.id, el)
                    else fields.current.delete(block.id)
                  }}
                  aria-label={t("blockText", { n })}
                  value={block.text}
                  rows={block.type === "heading" ? 1 : 4}
                  placeholder={t(block.type === "heading" ? "headingPlaceholder" : "textPlaceholder")}
                  className={cn(block.type === "heading" && "min-h-10 text-base font-semibold", block.type === "quote" && "italic")}
                  onChange={(e) => update(block.id, { text: e.target.value })}
                  onKeyDown={(e) => {
                    const key = e.key.toLowerCase()
                    if ((e.ctrlKey || e.metaKey) && (key === "b" || key === "i")) {
                      e.preventDefault()
                      mark(block, key === "b" ? "**" : "*")
                    }
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add("paragraph")}>
          <PlusIcon />
          {t("addParagraph")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("heading")}>
          <HeadingIcon />
          {t("addHeading")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("scene-break")}>
          <MinusIcon />
          {t("addSceneBreak")}
        </Button>
        <p className="type-small ml-auto font-medium tabular-nums" role="status">
          {t("wordCount", { count: words })}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
