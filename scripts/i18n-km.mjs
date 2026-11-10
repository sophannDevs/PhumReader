// Builds src/messages/km.json from design/i18n/km-dictionary.json (CLAUDE.md "Stack").
//
// For every string in src/messages/en.json:
//   - the dictionary's Khmer wins when the English text is a dictionary entry (the V2.1 design wording);
//   - otherwise the existing Khmer in km.json is kept.
// Keys that are in en.json but have no Khmer at all are listed; with --check the script then exits with 1.
// Keys in km.json that en.json no longer has are removed. Usage: npm run i18n:km [-- --check]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const en = read("src/messages/en.json")
const km = read("src/messages/km.json")
const dict = read("design/i18n/km-dictionary.json").strings
const check = process.argv.includes("--check")

const missing = []
let fromDict = 0

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
    out[k] = build(v, kmNode && typeof kmNode === "object" ? kmNode[k] : undefined, at ? `${at}.${k}` : k)
  }
  return out
}

const next = build(en, km, "")
if (!check) fs.writeFileSync(path.join(root, "src/messages/km.json"), JSON.stringify(next, null, 2) + "\n")

console.log(`km.json: ${fromDict} strings ${check ? "would change" : "updated"} from the dictionary, ${missing.length} without Khmer.`)
for (const k of missing) console.log(`  missing: ${k}`)
if (check && (missing.length > 0 || fromDict > 0)) process.exit(1)
