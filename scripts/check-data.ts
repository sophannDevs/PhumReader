// Dev-only sanity check for the data selectors. Run: npx tsx scripts/check-data.ts
import {
  creatorSeriesCount,
  dailyUpdates,
  demoData,
  derivedStats,
  episode,
  episodesFor,
  getSeries,
  getSeriesBySlug,
  novelChapter,
  rankings,
  relatedSeries,
} from "@/data"
import { today } from "@/lib/format"

let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  ${detail}` : ""}`)
}

const glass = getSeriesBySlug("glass-compass")!
check("glass-compass has 68 episodes", episodesFor("glass-compass").length === 68, String(episodesFor("glass-compass").length))
const archivist = episodesFor("the-last-archivist")
check(
  'the-last-archivist has 15 chapters titled "Chapter N: ..."',
  archivist.length === 15 && archivist.every((e) => /^Chapter \d+: .+/.test(e.title)),
  `${archivist.length} e.g. "${archivist[0].title}"`
)

let allFast = true
let allUp = true
let allResolved = true
for (const s of getSeries()) {
  const list = episodesFor(s.slug)
  if (list.length !== s.totalEpisodes) allResolved = false
  if (list.filter((e) => e.access === "fastpass").length !== 3) allFast = false
  const up = list.filter((e) => e.isUp)
  const latest = list[s.freeEpisodes - 1]
  if (up.length !== 1 || up[0].n !== s.freeEpisodes || latest.date !== "Nov 5, 2026") allUp = false
}
check(`every one of ${getSeries().length} series has total = free + 3 episodes`, allResolved)
check("3 Fast Pass episodes per series", allFast)
check(`episode freeEpisodes is the only UP and is dated Nov 5, 2026 (today = ${today})`, allUp)

const fp = episode("glass-compass", 66)!
check("Fast Pass dates are +7 days each", episode("glass-compass", 67)!.date === "Nov 19, 2026" && fp.date === "Nov 12, 2026")

const refs = [
  ...demoData.homeHero.map((h) => h.series),
  ...demoData.continueReading.map((c) => c.series),
  ...Object.keys(demoData.episodesSample),
]
const missing = refs.filter((slug) => !getSeriesBySlug(slug))
check("every referenced slug exists", missing.length === 0, missing.join(", "))

check(
  "Thursday shows the six series from the Home screen in order",
  dailyUpdates("Thu").map((s) => s.title).join(", ") ===
    "Paper Tigers, The Quiet Kingdom, Little Thunder, Wolves of Wren Street, Lantern Alley, Hollow Signal"
)
check(
  "Glass Compass related = Crown of Ash, Ink Witch, The Quiet Kingdom, The Cartographer's Daughter",
  relatedSeries(glass).map((s) => s.title).join(", ") ===
    "Crown of Ash, Ink Witch, The Quiet Kingdom, The Cartographer's Daughter"
)
const comics = rankings("comics")
check(
  "comics ranking top 8 matches Home (with movement)",
  comics.slice(0, 8).map((r) => `${r.series.title} ${r.movement}`).join(" | ") ===
    "Paper Tigers ▲ 2 | Neon Monsoon — | Tiny Dragon Café ▲ 5 | The Orchard Pact ▼ 1 | Summer Index NEW | Ember & Co. ▲ 1 | Captain Nobody ▼ 3 | Salt & Thunder —"
)
check("web novel ranking lists the 7 novels", rankings("novels").length === 7)
const stats = derivedStats(glass)
check("derived stats for Glass Compass = 84.3K subscribers, 2.4K comments", stats.subscribers === "84.3K" && stats.comments === "2.4K", JSON.stringify(stats))
const ch = novelChapter("letters-to-tuesday", 1)!
check('letters-to-tuesday chapter 1 = "Flour and Ink", Sep 12, 2024', ch.name === "Flour and Ink" && ch.date === "Sep 12, 2024", `${ch.name}, ${ch.date}`)
console.log(`\nCreator series counts: ${[...new Set(getSeries().map((s) => s.creator))].map((c) => `${c} ${creatorSeriesCount(c)}`).join(", ")}`)
console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
