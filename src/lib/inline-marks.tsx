import { Fragment } from "react"

/**
 * Chapter text may carry **bold** and *italic* marks (what the creator's editor writes). Turns the
 * marks into <strong> and <em>; any other character is shown as text, never as HTML.
 */
export function inlineMarks(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let key = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(<Fragment key={key++}>{text.slice(last, match.index)}</Fragment>)
    out.push(match[1] !== undefined ? <strong key={key++}>{match[1]}</strong> : <em key={key++}>{match[2]}</em>)
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>)
  return out
}
