import { describe, expect, it } from "vitest"
import type { Settings } from "@/lib/api/account"
import type { NotificationItem } from "@/lib/api/notifications"
import {
  inboxGroup,
  inTab,
  kindOf,
  notificationHref,
  prefsChange,
  prefsFromApi,
  prefsToApi,
  samePrefs,
} from "@/lib/notifications"
import { defaultNotifPrefs } from "@/lib/store"

/** The API's alert defaults (docs/API.md, GET /me/settings): the same as the website's. */
const API_DEFAULTS: Settings["notifications"] = {
  episodes: true,
  fastPass: true,
  types: {
    update: { push: true, email: false },
    comment: { push: true, email: false },
    coins: { push: true, email: true },
    fastpass: { push: true, email: false },
    news: { push: false, email: false },
  },
  quiet: { on: true, from: 22, to: 7 },
  digest: false,
}

const GLASS = { id: "s-glass", slug: "glass-compass", title: "Glass Compass", type: "comic" as const }
const LETTERS = { id: "s-letters", slug: "letters-to-tuesday", title: "Letters to Tuesday", type: "novel" as const }

const item = (over: Partial<NotificationItem> & Pick<NotificationItem, "type" | "kind">): NotificationItem => ({
  id: "n1",
  createdAt: "2026-11-05T03:00:00Z",
  read: false,
  episode: null,
  data: {},
  ...over,
})

describe("inboxGroup", () => {
  // Friday 6 November 2026, 00:30 in Phnom Penh.
  const now = Date.parse("2026-11-05T17:30:00Z")

  it("compares the dates in Cambodia time, not UTC", () => {
    expect(inboxGroup(Date.parse("2026-11-05T17:00:00Z"), now)).toBe("Today") // 6 Nov, 00:00 ICT
    expect(inboxGroup(Date.parse("2026-11-05T16:59:00Z"), now)).toBe("This week") // 5 Nov, 23:59 ICT
  })

  it("puts the 6 days before today in This week, older in Earlier", () => {
    expect(inboxGroup(Date.parse("2026-10-31T00:00:00Z"), now)).toBe("This week") // 31 Oct ICT: 6 days
    expect(inboxGroup(Date.parse("2026-10-30T16:59:00Z"), now)).toBe("Earlier") // 30 Oct ICT: 7 days
    expect(inboxGroup(Date.parse("2025-12-30T03:00:00Z"), now)).toBe("Earlier")
  })

  it("keeps an item from a clock running ahead in Today", () => {
    expect(inboxGroup(Date.parse("2026-11-06T02:00:00Z"), now)).toBe("Today")
  })
})

describe("notificationHref", () => {
  it.each([
    [item({ type: "episode_published", kind: "episode", series: GLASS, episode: 65 }), "/read/glass-compass/65"],
    [item({ type: "episode_published", kind: "episode", series: LETTERS, episode: 88 }), "/novel/letters-to-tuesday/88"],
    [item({ type: "comment_liked", kind: "comment", series: GLASS, episode: 3, data: { count: 2 } }), "/series/glass-compass/comments?ep=3"],
    [item({ type: "comment_liked", kind: "comment", series: GLASS, data: { count: 2 } }), "/series/glass-compass/comments"],
    [item({ type: "order_paid", kind: "coins", data: { orderNumber: "TW-48213377", coins: 33 } }), "/coins/orders/TW-48213377"],
    [item({ type: "order_refunded", kind: "coins", data: { orderNumber: "TW-1", coins: 5 } }), "/coins/orders/TW-1"],
    [item({ type: "order_paid", kind: "coins", data: { coins: 33 } }), "/coins"],
    [item({ type: "report_resolved", kind: "system", series: GLASS, episode: 4, data: { targetType: "comment", hidden: true } }), "/series/glass-compass"],
    [item({ type: "report_dismissed", kind: "system", series: LETTERS, data: { targetType: "series", hidden: false } }), "/series/letters-to-tuesday"],
    [item({ type: "series_approved", kind: "system", series: GLASS }), "/creator/series/s-glass"],
    [item({ type: "series_changes", kind: "system", series: GLASS, data: { items: ["cover"], note: null } }), "/creator/series/s-glass"],
    [item({ type: "series_rejected", kind: "system", series: LETTERS, data: { note: "No" } }), "/creator/series/s-letters"],
    [item({ type: "welcome", kind: "system" }), "/"],
  ])("%#: %o → %s", (x, href) => {
    expect(notificationHref(x)).toBe(href)
  })

  it("falls back when the series is gone", () => {
    expect(notificationHref(item({ type: "episode_published", kind: "episode", episode: 3 }))).toBe("/")
    expect(notificationHref(item({ type: "series_approved", kind: "system" }))).toBe("/creator")
  })
})

describe("tabs and kinds", () => {
  it("maps the API's kinds to the inbox's (episode = update)", () => {
    expect(kindOf(item({ type: "episode_published", kind: "episode" }))).toBe("update")
    expect(kindOf(item({ type: "comment_liked", kind: "comment" }))).toBe("comment")
    expect(kindOf(item({ type: "order_paid", kind: "coins" }))).toBe("coins")
    expect(kindOf(item({ type: "welcome", kind: "system" }))).toBe("system")
  })

  it("lists system items under All and Unread only", () => {
    const welcome = item({ type: "welcome", kind: "system" })
    expect(inTab("all", welcome)).toBe(true)
    expect(inTab("unread", welcome)).toBe(true)
    expect(inTab("unread", { ...welcome, read: true })).toBe(false)
    for (const tab of ["episodes", "comments", "coins"] as const) expect(inTab(tab, welcome)).toBe(false)
    expect(inTab("episodes", item({ type: "episode_published", kind: "episode" }))).toBe(true)
    expect(inTab("comments", item({ type: "comment_liked", kind: "comment" }))).toBe(true)
    expect(inTab("coins", item({ type: "order_refunded", kind: "coins" }))).toBe(true)
  })
})

describe("alert settings", () => {
  it("reads the account's settings as the page's pairs, and back", () => {
    const prefs = prefsFromApi(API_DEFAULTS)
    expect(prefs).toEqual(defaultNotifPrefs)
    expect(prefsToApi(prefs)).toEqual(API_DEFAULTS)
    // The pairs come from `types` (the older `episodes` / `fastPass` copies are ignored); the key order doesn't matter.
    expect(samePrefs(prefsFromApi({ ...API_DEFAULTS, fastPass: false }), defaultNotifPrefs)).toBe(true)
    expect(samePrefs({ ...defaultNotifPrefs, digest: true }, defaultNotifPrefs)).toBe(false)
  })

  it("sends only the switches that changed", () => {
    const before = prefsFromApi(API_DEFAULTS)
    expect(prefsChange(before, { update: [true, true] })).toEqual({ types: { update: { email: true } } })
    expect(prefsChange(before, { coins: [false, false] })).toEqual({ types: { coins: { push: false, email: false } } })
    expect(prefsChange(before, { update: [true, false] })).toEqual({})
    expect(prefsChange(before, { quiet: false })).toEqual({ quiet: { on: false } })
    expect(prefsChange(before, { from: 23, to: 7 })).toEqual({ quiet: { from: 23 } })
    expect(prefsChange(before, { digest: true })).toEqual({ digest: true })
    expect(prefsChange(before, { news: [true, false], digest: true })).toEqual({ types: { news: { push: true } }, digest: true })
  })
})
