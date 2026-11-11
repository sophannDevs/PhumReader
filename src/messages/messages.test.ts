import { describe, expect, it } from "vitest"
import en from "./en"
import km from "./km"

/** "creator.start" -> "Start publishing" for every leaf of a messages file (list items are "faq.items.0.q"). */
function flatten(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value }
  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, string>>(
      (out, [key, child]) => ({ ...out, ...flatten(child, path ? `${path}.${key}` : key) }),
      {},
    )
  }
  return {}
}

const enFlat = flatten(en)
const kmFlat = flatten(km)

/** Index of the "}" that closes the "{" at `open`. */
function closeOf(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}" && --depth === 0) return i
  }
  return text.length
}

/**
 * The {names} an ICU message needs filled in: plain {n} arguments and the argument of a plural / select, plus any
 * argument inside their branches. The branch keys ("chapter {…}", "one {…}") are not arguments.
 */
function placeholders(message: string): string[] {
  const names = new Set<string>()
  const walk = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== "{") continue
      const end = closeOf(text, i)
      const inner = text.slice(i + 1, end)
      const head = inner.match(/^\s*(\w+)\s*(?:,\s*(?:plural|select|selectordinal)\s*,([\s\S]*))?$/)
      const plain = inner.match(/^\s*(\w+)\s*(?:,|$)/)
      if (head?.[2] !== undefined || (plain && !/\{/.test(inner))) {
        names.add((head ?? plain)![1])
        for (let j = 0; head?.[2] !== undefined && j < head[2].length; j++) {
          if (head[2][j] !== "{") continue
          const close = closeOf(head[2], j)
          walk(head[2].slice(j, close + 1).slice(1, -1))
          j = close
        }
      } else {
        const select = inner.match(/^\s*(\w+)\s*,\s*(?:plural|select|selectordinal)\s*,/)
        if (select) names.add(select[1])
      }
      i = end
    }
  }
  walk(message)
  return [...names].sort()
}

describe("messages", () => {
  it("English and Khmer have the same keys", () => {
    const missingInKhmer = Object.keys(enFlat).filter((k) => !(k in kmFlat))
    const missingInEnglish = Object.keys(kmFlat).filter((k) => !(k in enFlat))
    expect({ missingInKhmer, missingInEnglish }).toEqual({ missingInKhmer: [], missingInEnglish: [] })
  })

  it("no message is empty", () => {
    const empty = [...Object.entries(enFlat), ...Object.entries(kmFlat)].filter(([, v]) => v.trim() === "").map(([k]) => k)
    expect(empty).toEqual([])
  })

  it("a Khmer message uses the same {placeholders} as the English one", () => {
    // The code passes both `count` (for English plurals) and `n` (the number in Khmer digits), and Khmer has no plural
    // forms: so `count` may be missing in Khmer, and `n` stands in for it.
    const need = (key: string) => {
      const en = placeholders(enFlat[key])
      const km = placeholders(kmFlat[key])
      const hasCount = en.includes("count")
      return {
        en: en.filter((name) => name !== "count"),
        km: km.filter((name) => name !== "count" && !(hasCount && name === "n" && !en.includes("n"))),
      }
    }
    const different = Object.keys(enFlat)
      .filter((k) => k in kmFlat && need(k).en.join() !== need(k).km.join())
      .map((k) => `${k}: en ${placeholders(enFlat[k]).join()} / km ${placeholders(kmFlat[k]).join()}`)
    expect(different).toEqual([])
  })
})
