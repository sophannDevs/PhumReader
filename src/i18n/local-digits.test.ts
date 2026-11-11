import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser"
import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"
import km from "@/messages/km"
import { localizeKmMessage, localizeKmMessages } from "./km-messages"
import { addKhmerValues, khmerValue, toKhmerDigits, withLocalDigits } from "./local-digits"

type Messages = { [key: string]: string | Messages }

function flatten(node: string | Messages, at = "", out: [string, string][] = []) {
  if (typeof node === "string") out.push([at, node])
  else for (const [key, child] of Object.entries(node)) flatten(child, at ? `${at}.${key}` : key, out)
  return out
}

/** Values that fill every argument of a message: text for plain ones, 3 for plurals, a tag function per tag. */
function sampleValues(message: string) {
  const values: Record<string, unknown> = {}
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (el.type === TYPE.argument) values[el.value] ??= "X"
      if (el.type === TYPE.plural) values[el.value] = 3
      if (el.type === TYPE.select) values[el.value] = "other"
      if (el.type === TYPE.tag) values[el.value] = (chunks: string) => `<${el.value}>${chunks}</${el.value}>`
      if ("options" in el) for (const opt of Object.values(el.options)) walk(opt.value)
      if (el.type === TYPE.tag) walk(el.children)
    }
  }
  walk(parse(message))
  return values
}

const translator = (message: string) =>
  createTranslator({
    locale: "km",
    messages: { m: message },
    onError: (error) => {
      throw error
    },
  })

describe("Khmer digits in messages (T44)", () => {
  it("rewrites every Khmer message without changing what it says (digits aside)", () => {
    const localized = new Map(flatten(localizeKmMessages(km) as unknown as Messages))
    for (const [key, message] of flatten(km as unknown as Messages)) {
      const values = sampleValues(message)
      const before = translator(message).markup("m" as never, values as never)
      const after = translator(localized.get(key)!).markup("m" as never, addKhmerValues(values) as never)
      expect(toKhmerDigits(after), key).toBe(toKhmerDigits(before))
    }
  })

  it("prints filled-in counts, episode numbers and coins with Khmer digits", () => {
    const t = (message: string, values: Record<string, unknown>) =>
      withLocalDigits(translator(localizeKmMessage(message)))("m" as never, values as never)
    expect(t("ភាគ {n} នៃ {title}", { n: 12, title: "1984" })).toBe("ភាគ ១២ នៃ 1984")
    expect(t("{count} កាក់", { count: 250 })).toBe("២៥០ កាក់")
    expect(t("{days, plural, =0 {ថ្ងៃនេះ} other {ក្នុង # ថ្ងៃ}}", { days: 0 })).toBe("ថ្ងៃនេះ")
    expect(t("{days, plural, =0 {ថ្ងៃនេះ} other {ក្នុង # ថ្ងៃ}}", { days: 7 })).toBe("ក្នុង ៧ ថ្ងៃ")
    expect(t("{unit, select, novel {ជំពូក {n}} other {ភាគ {n}}}", { unit: "novel", n: 3 })).toBe("ជំពូក ៣")
    expect(t("ភាគ {list}", { list: "12, 13" })).toBe("ភាគ ១២, ១៣")
  })

  it("keeps money, codes and names as they are", () => {
    expect(khmerValue("price", "$4.99")).toBe("$4.99")
    expect(khmerValue("total", "20,000៛")).toBe("20,000៛")
    expect(khmerValue("code", "123456")).toBe("123456")
    expect(khmerValue("id", 1042)).toBe(1042)
    expect(khmerValue("title", "2077")).toBe("2077")
    expect(khmerValue("q", "12")).toBe("12")
    expect(khmerValue("views", "84.3K")).toBe("៨៤.៣K")
    expect(khmerValue("age", "16+")).toBe("១៦+")
  })

  it("leaves English messages alone", () => {
    const en = createTranslator({ locale: "en", messages: { m: "Episode {n}" } })
    expect(withLocalDigits(en)("m", { n: 12 } as never)).toBe("Episode 12")
  })

  it("wraps each translator once, so its identity is stable", () => {
    const t = translator("{n}")
    expect(withLocalDigits(t)).toBe(withLocalDigits(t))
  })
})
