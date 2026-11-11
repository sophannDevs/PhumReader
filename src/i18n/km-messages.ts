import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser"
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js"
import { SUFFIX } from "./local-digits"

/**
 * The Khmer half of local-digits.ts: every printed `{arg}` and every `#` in a Khmer message becomes `{arg__kh}`,
 * the value with Khmer digits that the wrapped translators add. Runs once on the server when the messages load
 * (src/i18n/messages.ts), so the message parser stays out of the browser bundle.
 */

function rewrite(elements: MessageFormatElement[], plural?: string): MessageFormatElement[] {
  return elements.map((el) => {
    if (el.type === TYPE.argument) return { ...el, value: el.value + SUFFIX }
    if (el.type === TYPE.pound && plural) return { type: TYPE.argument, value: plural + SUFFIX, location: el.location }
    if (el.type === TYPE.plural) {
      // `#` is the value minus the offset; no message uses an offset, so keep `#` if one ever does.
      const own = el.offset ? undefined : el.value
      const options = Object.fromEntries(
        Object.entries(el.options).map(([key, opt]) => [key, { ...opt, value: rewrite(opt.value, own) }]),
      )
      return { ...el, options }
    }
    if (el.type === TYPE.select) {
      const options = Object.fromEntries(
        Object.entries(el.options).map(([key, opt]) => [key, { ...opt, value: rewrite(opt.value, plural) }]),
      )
      return { ...el, options }
    }
    if (el.type === TYPE.tag) return { ...el, children: rewrite(el.children, plural) }
    return el
  })
}

/** One Khmer message with every printed `{arg}` and `#` as `{arg__kh}`. Unchanged when it has no arguments. */
export function localizeKmMessage(message: string): string {
  if (!message.includes("{")) return message
  return printAST(rewrite(parse(message)))
}

/** All Khmer messages (nested objects and lists of strings), each rewritten by `localizeKmMessage`. */
export function localizeKmMessages<M>(messages: M): M {
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return localizeKmMessage(node)
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === "object")
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]))
    return node
  }
  return walk(messages) as M
}

