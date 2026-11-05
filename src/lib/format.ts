/** Shared formatters. T16 extends this file (today, formatDate, formatCount). */

/** "Sokha P." -> "SP", "Sokha Chan" -> "SC", "Owen" -> "O". Max 2 letters. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

/** "Sokha Chan" -> "Sokha" */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
}
