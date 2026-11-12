import { deflateSync } from "node:zlib"
import type { Locator, Page } from "@playwright/test"

export const DEMO = { email: "reader@phumireader.app", password: "PhumiReader1!", code: "123456" }

type Seed = {
  user?: { name: string; email: string; roles?: string[] } | null
  coins?: number
  returnTo?: string | null
  lang?: "en" | "km"
}

/** Seeds `phumireader.app` (the persisted zustand store) before the app loads. */
export async function seed(page: Page, state: Seed = {}) {
  await page.addInitScript((s) => {
    // Only the first load: a reload in the same test must keep what the app saved since.
    if (sessionStorage.getItem("e2e-seeded")) return
    sessionStorage.setItem("e2e-seeded", "1")
    localStorage.setItem("phumireader.app", JSON.stringify({ state: s, version: 1 }))
  }, state)
}

export const SOKHA = { name: "Sokha Chan", email: DEMO.email }
export const ADMIN = { name: "Dara M.", email: "admin@phumireader.app", roles: ["READER", "CREATOR", "ADMIN"] }
export const CREATOR = { name: "Dara Vann", email: "creator@phumireader.app", roles: ["READER", "CREATOR"] }

/**
 * Cache Components keeps the previous route mounted but hidden, so a locator can match
 * two copies; this keeps the visible one.
 */
export const visible = (locator: Locator) => locator.locator("visible=true").first()

/**
 * Picks an option of a `NativeSelect` (the animated Radix Select; it replaced the native <select>): opens the list
 * from the trigger, then clicks the option by its value (`data-value`) or by its visible label.
 */
export async function selectOption(trigger: Locator, option: string | { label: string }) {
  await trigger.click()
  const listbox = visible(trigger.page().getByRole("listbox"))
  const item =
    typeof option === "string"
      ? listbox.locator(`[role="option"][data-value=${JSON.stringify(option)}]`)
      : listbox.getByRole("option", { name: option.label, exact: true })
  await item.click()
}

/** A plain RGB PNG of the given size (the upload checks the real pixel width: 690–1600 px). */
export function png(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, "ascii"), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const row = Buffer.alloc(1 + width * 3, 0x3c) // filter byte + grey pixels
  row[0] = 0
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
