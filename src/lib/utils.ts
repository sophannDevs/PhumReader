export { cn } from "cn"

/**
 * Edit distance (Levenshtein: insert, delete or replace one character, each costs 1), counted in UTF-16 code units.
 * Search's "Search “…” instead" and the 404 page's "Did you mean" use it.
 */
export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length]
}
