// Builds the Khmer messages (src/messages/km/<namespace>.json) from design/i18n/km-dictionary.json (CLAUDE.md "Stack").
//
// For every string in src/messages/en/<namespace>.json:
//   - the dictionary's Khmer wins when the English text is a dictionary entry (the V2.1 design wording);
//   - otherwise the existing Khmer is kept.
// Strings that have no Khmer at all are listed (and get the English text for now); with --check the script exits
// with 1 instead of writing. Keys that en no longer has are removed. Only files whose content changes are written.
// Usage: npm run i18n:km [-- --check] [-- <namespace> ...]   (no namespace = all of them)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dir = path.join(root, "src/messages")
const dict = JSON.parse(fs.readFileSync(path.join(root, "design/i18n/km-dictionary.json"), "utf8")).strings
const args = process.argv.slice(2)
const check = args.includes("--check")
const only = args.filter((a) => !a.startsWith("--"))
const namespaces = fs
  .readdirSync(path.join(dir, "en"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .filter((ns) => only.length === 0 || only.includes(ns))

const missing = []
let fromDict = 0
let changedFiles = 0

function build(enNode, kmNode, at) {
  if (typeof enNode === "string") {
    if (Object.hasOwn(dict, enNode)) {
      if (kmNode !== dict[enNode]) fromDict++
      return dict[enNode]
    }
    if (typeof kmNode === "string" && kmNode.length > 0) return kmNode
    missing.push(at)
    return enNode
  }
  if (Array.isArray(enNode)) {
    return enNode.map((v, i) => build(v, Array.isArray(kmNode) ? kmNode[i] : undefined, `${at}[${i}]`))
  }
  const out = {}
  for (const [k, v] of Object.entries(enNode)) {
    out[k] = build(v, kmNode && typeof kmNode === "object" ? kmNode[k] : undefined, `${at}.${k}`)
  }
  return out
}

for (const ns of namespaces) {
  const en = JSON.parse(fs.readFileSync(path.join(dir, "en", `${ns}.json`), "utf8"))
  const kmFile = path.join(dir, "km", `${ns}.json`)
  const km = fs.existsSync(kmFile) ? JSON.parse(fs.readFileSync(kmFile, "utf8")) : {}
  const next = JSON.stringify(build(en, km, ns), null, 2) + "\n"
  const current = fs.existsSync(kmFile) ? fs.readFileSync(kmFile, "utf8").replace(/\r\n/g, "\n") : ""
  if (next !== current) {
    changedFiles++
    if (!check) fs.writeFileSync(kmFile, next)
  }
}

console.log(
  `km: ${namespaces.length} namespaces, ${changedFiles} file(s) ${check ? "out of date" : "written"}, ` +
    `${fromDict} string(s) from the dictionary, ${missing.length} without Khmer.`
)
for (const k of missing) console.log(`  missing: ${k}`)
if (check && (missing.length > 0 || changedFiles > 0)) process.exit(1)
