// Khmer native review (T44, launch blocker A12): every UI string in English and Khmer, side by side.
//
// Export (default): writes docs/KHMER_REVIEW.md (to read, grouped by page) and docs/khmer-review.csv (to edit in
// Excel or Google Sheets: the reviewer fills `khmer_corrected` and `comment`) from src/messages/en and km.
// Apply: reads a filled-in CSV back. Every corrected string must parse as an ICU message and use exactly the same
// {placeholders} as the English one; good rows are written to src/messages/km/<namespace>.json, bad rows are listed.
// Usage: npm run i18n:review
//        npm run i18n:review -- --apply docs/khmer-review.csv [--dry-run]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse, TYPE } from "@formatjs/icu-messageformat-parser"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dir = path.join(root, "src/messages")
const mdFile = path.join(root, "docs/KHMER_REVIEW.md")
const csvFile = path.join(root, "docs/khmer-review.csv")
const dict = JSON.parse(fs.readFileSync(path.join(root, "design/i18n/km-dictionary.json"), "utf8")).strings
const args = process.argv.slice(2)

/** Where each namespace shows up, for the reviewer (route or screen). */
const PAGES = {
  nav: ["Navigation", "Header, menus and the phone tab bar"],
  common: ["Common", "Site name and words used on many pages"],
  home: ["Home", "/"],
  cards: ["Series cards", "Small labels on series covers everywhere"],
  data: ["Content labels", "Genre names, update days, episode and chapter labels, payment methods, FAQ"],
  series: ["Series page", "/series/<slug>"],
  episodes: ["Episode list", "Episode rows on the series page"],
  reader: ["Reader", "/read/<series>/<episode> (comics) and /novel/<series>/<chapter> (novels)"],
  comments: ["Comments", "/series/<slug>/comments and the comments under each episode"],
  report: ["Report dialog", "Report a series, episode or comment"],
  unlock: ["Unlock dialog", "Unlocking a Fast Pass episode with coins"],
  rankings: ["Rankings", "/rankings"],
  genresPage: ["Genres", "/genres and /genres/<genre>"],
  search: ["Search", "/search and the search box"],
  library: ["Library", "/library"],
  coins: ["Coins", "/coins (buy coins, pay with KHQR, ABA Pay or card)"],
  packs: ["Coin packs", "Coin pack cards on the Coins page"],
  receipt: ["Receipt", "/coins/orders/<id>"],
  notifications: ["Notifications", "/notifications"],
  settings: ["Settings", "/settings"],
  account: ["Account", "Settings › Account (email, password, devices)"],
  auth: ["Log in and sign up", "/login, /signup, /verify (email code), /forgot, /reset"],
  welcome: ["Welcome", "/welcome (first-time setup)"],
  join: ["Become a creator", "/creators/join"],
  creator: ["Creator dashboard", "/creator"],
  seriesForm: ["Create series", "/creator/series/new and /creator/series/<id>/edit"],
  manage: ["Manage series", "/creator/series/<id>"],
  episodeForm: ["Upload episode", "/creator/upload, /creator/series/<id>/episodes/new and …/<n>/edit"],
  earnings: ["Earnings", "/creator/earnings"],
  profile: ["Creator profile", "/creators/<handle>"],
  admin: ["Admin", "/admin and its pages (series, reports, payments, orders, users, content, audit)"],
  help: ["Help center", "/help"],
  legal: ["Policies", "/terms, /privacy, /legal/<doc> (draft templates; a lawyer reviews the content)"],
  footer: ["Footer", "Bottom of every page"],
  comingSoon: ["Coming soon", "/coming-soon (pages that are not built yet)"],
  notFound: ["Page not found", "404 page"],
  errors: ["Error pages", "Error 404 / 500, /maintenance, /offline"],
  states: ["Page states", "Empty, error and loading states on many pages"],
  toasts: ["Toasts", "Short pop-up messages after an action"],
}

/** The core words, so the same English word gets the same Khmer word everywhere. */
const GLOSSARY = [
  "Home", "Rankings", "Genres", "Library", "Search", "Comic", "Novel", "Web novel", "Series", "Episode",
  "Chapter", "Creator", "Coins", "Fast Pass", "Unlock", "Subscribe", "Subscribed", "Comments", "Report",
  "Settings", "Notifications", "Log in", "Sign up", "Log out", "Free", "Completed", "Ongoing", "Draft",
  "Published", "Earnings",
]

// ---- reading the messages

const namespaces = fs
  .readdirSync(path.join(dir, "en"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .sort((a, b) => order(a) - order(b) || a.localeCompare(b))

function order(ns) {
  const i = Object.keys(PAGES).indexOf(ns)
  return i === -1 ? 999 : i
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"))

function flatten(node, at = "", out = []) {
  if (typeof node === "string") out.push([at, node])
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) flatten(v, at ? `${at}.${k}` : k, out)
  return out
}

/**
 * What a message shows: the {arguments} it prints (`#` prints its plural's argument) and its <tags>, sorted, plus
 * every argument it reads (also the ones that only pick a plural / select branch).
 */
function placeholders(message) {
  const printed = new Set()
  const used = new Set()
  const walk = (els, plural) => {
    for (const el of els) {
      if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) {
        printed.add(`{${el.value}}`)
        used.add(el.value)
      }
      if (el.type === TYPE.pound && plural) printed.add(`{${plural}}`)
      if (el.type === TYPE.plural || el.type === TYPE.select) {
        used.add(el.value)
        for (const opt of Object.values(el.options)) walk(opt.value, el.type === TYPE.plural ? el.value : plural)
      }
      if (el.type === TYPE.tag) {
        printed.add(`<${el.value}>`)
        walk(el.children, plural)
      }
    }
  }
  walk(parse(message))
  return { printed: [...printed].sort().join(" "), used }
}

/**
 * Why a translation doesn't fit its English, or "". It must print the same arguments and tags (Khmer may drop a
 * plural / select the English needs, since Khmer has no plural forms), and may only read arguments the app sends.
 */
function mismatch(english, translation) {
  const want = placeholders(english)
  const got = placeholders(translation)
  if (want.printed !== got.printed) return `shows ${got.printed || "(nothing)"} but the English shows ${want.printed || "(nothing)"}`
  const unknown = [...got.used].filter((a) => !want.used.has(a))
  return unknown.length ? `uses {${unknown.join("}, {")}}, which the app doesn't send` : ""
}

function rows() {
  const out = []
  for (const ns of namespaces) {
    const en = flatten(readJson(path.join(dir, "en", `${ns}.json`)))
    const km = new Map(flatten(readJson(path.join(dir, "km", `${ns}.json`))))
    for (const [key, english] of en) out.push({ ns, key: `${ns}.${key}`, english, khmer: km.get(key) ?? "" })
  }
  return out
}

// ---- export

const KHMER = /[ក-៿]/

function notes(r) {
  const n = []
  if (!r.khmer) n.push("missing")
  else if (r.khmer === r.english) n.push(KHMER.test(r.english) ? "" : "same as English")
  try {
    if (mismatch(r.english, r.khmer)) n.push("placeholders differ")
  } catch {
    n.push("does not parse")
  }
  if (/[0-9]/.test(r.khmer.replace(/\{[^{}]*\}/g, ""))) n.push("Latin digits")
  return n.filter(Boolean).join(", ")
}

const cell = (s) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").replace(/</g, "&lt;")
const csvCell = (s) => `"${String(s).replace(/"/g, '""')}"`

function exportFiles() {
  const all = rows()
  const words = all.reduce((n, r) => n + r.english.split(/\s+/).filter(Boolean).length, 0)
  const flagged = all.filter((r) => notes(r))
  const today = new Date().toISOString().slice(0, 10)

  const md = []
  md.push("# Khmer review: every UI string in English and Khmer")
  md.push("")
  md.push(
    `Generated by \`npm run i18n:review\` on ${today} from \`src/messages/en\` and \`src/messages/km\`. ` +
      "Don't edit this file by hand: run the script again after the messages change.",
  )
  md.push("")
  md.push(
    `PhumiReader (ភូមិReader) has **${all.length.toLocaleString("en-US")} UI strings** ` +
      `(about ${words.toLocaleString("en-US")} English words) in ${namespaces.length} groups. The Khmer is a ` +
      "draft built from `design/i18n/km-dictionary.json`; a native Khmer speaker has to review all of it before " +
      "launch (task T44, launch blocker A12). Series titles, synopses, creator names and comments are content, " +
      "not UI, and are not part of this review.",
  )
  md.push("")
  md.push("## How to review")
  md.push("")
  md.push("1. Read the strings page by page below, ideally with the website open in Khmer (`/km/...`) next to it.")
  md.push(
    "2. Write corrections in **`docs/khmer-review.csv`** (open it in Excel or Google Sheets): put the new Khmer in " +
      "the `khmer_corrected` column and anything to discuss in `comment`. Leave both empty when the draft is fine.",
  )
  md.push(
    '3. Save it as **CSV UTF-8** (Excel: *File › Save As › CSV UTF-8*; Google Sheets: *File › Download › CSV*). ' +
      "Other CSV types lose the Khmer letters.",
  )
  md.push(
    "4. A developer applies it with `npm run i18n:review -- --apply docs/khmer-review.csv`. The script refuses a " +
      "correction whose `{placeholders}` don't match the English, and lists it.",
  )
  md.push("")
  md.push("## Rules for the Khmer text")
  md.push("")
  md.push(
    "- **Placeholders stay exactly as they are.** `{title}`, `{count}`, `{date}` are filled in by the app. Move " +
      "them anywhere in the sentence, but don't translate or remove them.",
  )
  md.push(
    "- **Plural and select messages:** in `{count, plural, one {# coin} other {# coins}}` translate only the text " +
      "inside the inner braces. Khmer has no plural forms, so `other {...}` alone is enough; keep `=0 {...}` or " +
      "`=1 {...}` when the English has them. In `{unit, select, novel {chapter} other {episode}}` translate each " +
      "branch. `#` is the number.",
  )
  md.push("- **Tags** such as `<b>…</b>` or `<link>…</link>` stay; translate the words between them.")
  md.push(
    "- **Numbers** (decided 2026-11-11): Khmer digits (០–៩) for counts, episode and chapter numbers, dates and " +
      "times; Latin digits (0–9) for money: US dollar and riel prices such as `$4.99` or `20,000៛`. Coins count " +
      "as a number, not money (`៥ កាក់`). Numbers that the app fills into a placeholder are converted " +
      "automatically; numbers written into a string must follow the same rule. Strings marked “Latin digits” " +
      "below contain Latin digits outside placeholders: check whether they are money.",
  )
  md.push(
    "- **Names stay as written:** PhumiReader / ភូមិReader, Fast Pass, KHQR, ABA Pay, Visa, Mastercard, Google, " +
      "Facebook, and every series title and creator name.",
  )
  md.push("- **Tone:** friendly and short. Buttons are actions (ចូលគណនី, ទិញកាក់), not descriptions.")
  md.push("")
  md.push("## Glossary")
  md.push("")
  md.push("The draft uses these words for the core terms. Change a term once here and in every string that uses it.")
  md.push("")
  md.push("| English | Khmer (draft) |")
  md.push("|---|---|")
  for (const term of GLOSSARY) if (dict[term]) md.push(`| ${cell(term)} | ${cell(dict[term])} |`)
  md.push("")
  md.push("## Strings that need a look first")
  md.push("")
  md.push(
    `${flagged.length} strings are flagged in the **Notes** column: “same as English” (not translated yet, or a ` +
      "name that stays in Latin letters), “Latin digits” (see the number rule) and “placeholders differ”.",
  )
  md.push("")
  md.push("## Contents")
  md.push("")
  for (const ns of namespaces) {
    const [name, where] = PAGES[ns] ?? [ns, ""]
    const count = all.filter((r) => r.ns === ns).length
    md.push(`- [${name}](#${anchor(name, ns)}) (${count}): ${where}`)
  }
  md.push("")
  for (const ns of namespaces) {
    const [name, where] = PAGES[ns] ?? [ns, ""]
    md.push(`## ${name} · \`${ns}\``)
    md.push("")
    if (where) md.push(`Where: ${where}`)
    md.push("")
    md.push("| Key | English | Khmer (draft) | Notes |")
    md.push("|---|---|---|---|")
    for (const r of all.filter((x) => x.ns === ns))
      md.push(`| \`${r.key.slice(ns.length + 1)}\` | ${cell(r.english)} | ${cell(r.khmer)} | ${notes(r)} |`)
    md.push("")
  }
  fs.writeFileSync(mdFile, md.join("\n"))

  const header = ["key", "page", "english", "khmer_draft", "khmer_corrected", "comment", "notes"]
  const lines = [header.join(",")]
  for (const r of all)
    lines.push([r.key, (PAGES[r.ns] ?? [r.ns])[0], r.english, r.khmer, "", "", notes(r)].map(csvCell).join(","))
  // BOM so Excel opens it as UTF-8 (otherwise the Khmer letters are garbled).
  fs.writeFileSync(csvFile, "﻿" + lines.join("\r\n") + "\r\n")

  console.log(`${all.length} strings (${flagged.length} flagged) → ${rel(mdFile)}, ${rel(csvFile)}`)
}

/** GitHub's heading anchor for "## Name · `ns`". */
const anchor = (name, ns) =>
  `${name} · ${ns}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-")

const rel = (file) => path.relative(root, file).replace(/\\/g, "/")

// ---- apply

/** RFC 4180 CSV (quoted fields may hold commas, quotes and line breaks). */
function parseCsv(text) {
  const out = []
  let row = []
  let field = ""
  let quoted = false
  const endRow = () => {
    row.push(field)
    out.push(row)
    row = []
    field = ""
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += c
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      endRow()
    } else field += c
  }
  if (field || row.length) endRow()
  return out.filter((r) => r.some((f) => f !== ""))
}

function setPath(obj, keys, value) {
  let node = obj
  for (const k of keys.slice(0, -1)) node = node[k]
  node[keys.at(-1)] = value
}

function apply(file, dryRun) {
  const [header, ...data] = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""))
  const col = (name) => {
    const i = header.indexOf(name)
    if (i === -1) throw new Error(`${file}: no "${name}" column`)
    return i
  }
  const [kKey, kFix] = [col("key"), col("khmer_corrected")]
  const english = new Map(rows().map((r) => [r.key, r]))
  const files = new Map()
  const problems = []
  let applied = 0
  for (const row of data) {
    const key = row[kKey]?.trim()
    const fixed = row[kFix]?.trim()
    if (!key || !fixed) continue
    const source = english.get(key)
    if (!source) {
      problems.push(`${key}: no such key (renamed or removed since the export?)`)
      continue
    }
    if (fixed === source.khmer) continue
    try {
      const why = mismatch(source.english, fixed)
      if (why) {
        problems.push(`${key}: ${why}`)
        continue
      }
    } catch (err) {
      problems.push(`${key}: not a valid message (${err.message})`)
      continue
    }
    const [ns, ...keys] = key.split(".")
    const kmFile = path.join(dir, "km", `${ns}.json`)
    if (!files.has(kmFile)) files.set(kmFile, readJson(kmFile))
    setPath(files.get(kmFile), keys, fixed)
    applied++
  }
  if (!dryRun) for (const [f, json] of files) fs.writeFileSync(f, JSON.stringify(json, null, 2) + "\n")
  console.log(`${dryRun ? "Would apply" : "Applied"} ${applied} corrections in ${files.size} files.`)
  if (problems.length) {
    console.log(`${problems.length} rows skipped:`)
    for (const p of problems) console.log(`  - ${p}`)
    process.exitCode = 1
  }
}

const applyAt = args.indexOf("--apply")
if (applyAt !== -1) {
  const file = args[applyAt + 1]
  if (!file) throw new Error("--apply needs the CSV file")
  apply(path.resolve(file), args.includes("--dry-run"))
} else {
  exportFiles()
}
