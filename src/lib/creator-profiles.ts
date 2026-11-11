import { demoData, getSeries, type Series } from "@/data"
import { creatorHandle } from "@/lib/routes"

/**
 * Creator profiles (/creators/[handle], spec §17). The demo data has no profile records: every creator name in the
 * demo series has a profile (handle = slug of the name). The demo creator account (creator@phumireader.app) also
 * owns the studio works in the store (`myWorks`), so its profile lists them too, with the prototype's bio and posts.
 */

/** "Dara Vann": the demo account with the creator role. */
export const DEMO_CREATOR_NAME = demoData.demoAccounts.find((a) => a.role === "creator")?.name ?? "Dara Vann"

/** Every creator name in the demo series, once. */
export const creatorNames = (): string[] => [...new Set(getSeries().map((s) => s.creator))]

/** The creator's name for a handle, or undefined when no demo series has it. */
export function creatorNameByHandle(handle: string): string | undefined {
  return getSeries().find((s) => creatorHandle(s.creator) === handle)?.creator
}

/** The creator's series in the demo catalog. */
export const catalogSeriesBy = (name: string): Series[] => getSeries().filter((s) => s.creator === name)

/** Prototype content (design/prototype-src/Profile/page.js): demo text, English in both languages. */
export const DEMO_CREATOR_BIO =
  "I draw quiet stories about rivers, markets and the people in between. New River Lantern episodes every Saturday."

export type CreatorPost = { date: string; title: string; body: string; likes: string; comments: number }

/** The demo creator's Updates tab (prototype posts; dates counted back from the pinned demo today, Nov 5, 2026). */
export const DEMO_CREATOR_POSTS: CreatorPost[] = [
  {
    date: "2026-11-03",
    title: "Behind the panels: Episode 24",
    body: "The ferry scene took 3 weeks. Here are my first sketches and the colour tests that didn’t make it.",
    likes: "1.2K",
    comments: 86,
  },
  {
    date: "2026-11-01",
    title: "New series coming soon",
    body: "Night Market Detectives is in review! Two cousins, one noodle stall, lots of tiny mysteries.",
    likes: "2.4K",
    comments: 210,
  },
  {
    date: "2026-10-18",
    title: "Thank you for 10,000 subscribers",
    body: "I started River Lantern on my phone during lunch breaks. Thank you for reading every Saturday.",
    likes: "3.1K",
    comments: 342,
  },
]

/** Profiles without an edit have been creating since March 2024 and are in Phnom Penh (profile.defaultPlace), as in the prototype. */
export const CREATING_SINCE = "2024-03-01"
