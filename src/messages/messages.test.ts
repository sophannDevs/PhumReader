import { describe, expect, it } from "vitest"
import en from "./en.json"
import km from "./km.json"

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

/** The {names} an ICU message needs filled in (plural / select bodies are skipped). */
const placeholders = (message: string) => [...new Set([...message.matchAll(/\{(\w+)(?:,|\})/g)].map((m) => m[1]))].sort()

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
    const different = Object.keys(enFlat)
      .filter((k) => k in kmFlat && placeholders(enFlat[k]).join() !== placeholders(kmFlat[k]).join())
      .map((k) => `${k}: en ${placeholders(enFlat[k]).join()} / km ${placeholders(kmFlat[k]).join()}`)
    expect(different).toEqual([])
  })
})
