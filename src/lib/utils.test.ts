import { describe, expect, it } from "vitest"
import { editDistance } from "@/lib/utils"

describe("editDistance", () => {
  it("is 0 for the same text and the other text's length against an empty one", () => {
    expect(editDistance("", "")).toBe(0)
    expect(editDistance("glass-compass", "glass-compass")).toBe(0)
    expect(editDistance("", "abc")).toBe(3)
    expect(editDistance("abc", "")).toBe(3)
  })

  it("counts inserts, deletes and replacements as one each", () => {
    expect(editDistance("kitten", "sitting")).toBe(3)
    expect(editDistance("glas-compas", "glass-compass")).toBe(2)
    expect(editDistance("flaw", "lawn")).toBe(2)
    expect(editDistance("tiny dragn", "tiny dragon")).toBe(1)
  })

  it("is symmetric", () => {
    for (const [a, b] of [["sunday", "saturday"], ["neon", "noen"], ["ink witch", "inkwitch"]]) {
      expect(editDistance(a, b)).toBe(editDistance(b, a))
    }
  })
})
