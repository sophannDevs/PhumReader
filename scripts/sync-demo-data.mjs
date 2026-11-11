// Writes src/data/demo-data.json from design/demo-data.json (the only source of demo content).
//
// The website and the backend seed (backend/build.gradle.kts copies src/data/demo-data.json) read the series and coin
// packs in the shape used since V1, so two records are converted; every other key is copied as is:
//   - series: V2.1 keeps only `episodes` (the free ones), `day`, `up`, `isNew`, `novel`. Every series gets 3 Fast Pass
//     episodes after the free ones (`episodeRule`; the prototype does the same for completed series, Assumption V2-1). Five V2.1 slugs lost
//     characters when they were generated; the V1 slugs are kept (Assumption V2-2).
//   - coin packs: prices stay the [PRICE USD] / [PRICE KHR] placeholders (Assumption V2-3).
// Usage: npm run data:sync [-- --check]   (--check exits with 1 when src/data is out of date)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = JSON.parse(fs.readFileSync(path.join(root, "design/demo-data.json"), "utf8"))
const target = path.join(root, "src/data/demo-data.json")

const FAST_PASS_AHEAD = 3
const V1_SLUGS = {
  "tiny-dragon-caf": "tiny-dragon-cafe",
  "ember-co": "ember-and-co",
  "salt-thunder": "salt-and-thunder",
  "silk-steel": "silk-and-steel",
  "volt-vale": "volt-and-vale",
}

const series = source.series.map((s) => {
  const fastPass = FAST_PASS_AHEAD
  return {
    id: s.id,
    slug: V1_SLUGS[s.slug] ?? s.slug,
    title: s.title,
    type: s.type,
    genre: s.genre,
    creator: s.creator,
    cover: s.cover,
    views: s.views,
    likes: s.likes,
    freeEpisodes: s.episodes,
    fastPassEpisodes: fastPass,
    totalEpisodes: s.episodes + fastPass,
    updateDay: s.day,
    schedule: s.schedule,
    badges: { up: s.up, isNew: s.isNew },
    status: s.status,
    language: ["en", "km"],
    ageRating: "all",
  }
})

const coinPacks = source.coinPacks.map((p) => ({
  coins: p.coins,
  bonus: p.bonus,
  tag: p.tag || null,
  priceUSD: "[PRICE USD]",
  priceKHR: "[PRICE KHR]",
}))

const out = JSON.stringify({ ...source, series, coinPacks }, null, 2) + "\n"
const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : ""

if (process.argv.includes("--check")) {
  if (current !== out) {
    console.error("src/data/demo-data.json is out of date: run npm run data:sync")
    process.exit(1)
  }
  console.log("src/data/demo-data.json is up to date.")
} else {
  fs.writeFileSync(target, out)
  console.log(`src/data/demo-data.json written (${series.length} series, ${coinPacks.length} packs).`)
}
