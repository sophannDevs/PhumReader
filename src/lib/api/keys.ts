/**
 * TanStack Query key factory for PhumReader (P5-01).
 * Centralizes all cache keys to ensure consistent caching, prefetching, and invalidation.
 */

export const catalogKeys = {
  all: ["catalog"] as const,
  home: (flag?: string | null) => ["home", flag ?? null] as const,
  series: (slug: string, flag?: string | null) => ["series", slug, flag ?? null] as const,
  episodes: (slug: string, flag?: string | null) => ["episodes", slug, flag ?? null] as const,
  episode: (slug: string, n: number, flag?: string | null) => ["episode", slug, n, flag ?? null] as const,
  chapter: (slug: string, n: number, flag?: string | null) => ["chapter", slug, n, flag ?? null] as const,
  rankings: (kind: "comics" | "novels", flag?: string | null) => ["rankings", kind, flag ?? null] as const,
  genre: (genre: string, flag?: string | null) => ["genre", genre, flag ?? null] as const,
  search: (query: string, flag?: string | null) => ["search", query.trim().toLowerCase(), flag ?? null] as const,
}

export const meKeys = {
  all: ["me"] as const,
  profile: (email?: string) => ["profile", email ?? ""] as const,
  viewer: (email: string, slug: string) => ["viewer", email, slug] as const,
  subscriptions: (email: string) => ["subscriptions", email] as const,
  history: (email: string) => ["history", email] as const,
  unlocked: (email: string) => ["unlocked", email] as const,
  follows: (email: string) => ["follows", email] as const,
  devices: (email?: string) => ["devices", email ?? ""] as const,
}

export const walletKeys = {
  all: ["wallet"] as const,
  balance: (email?: string) => ["wallet", email ?? ""] as const,
  coinsPage: (email?: string, flag?: string | null) => ["coins-page", email ?? "", flag ?? null] as const,
}

export const commentsKeys = {
  all: ["comments"] as const,
  thread: (kind: "series" | "episode", slug: string, flag?: string | null) => ["comments", kind, slug, flag ?? null] as const,
  threadAccount: (email: string, slug: string) => ["thread", email, slug] as const,
}

export const creatorKeys = {
  all: ["creator"] as const,
  dashboard: (email?: string, flag?: string | null) => ["creator", "dashboard", email ?? "", flag ?? null] as const,
  series: (email: string, filter: { q?: string; visibility?: string }) =>
    ["creator", "series", email, filter.q, filter.visibility] as const,
  seriesEdit: (email: string, id: string) => ["creator", "series-edit", email, id] as const,
  episodes: (email: string, seriesId: string) => ["creator", "episodes", email, seriesId] as const,
  episodeEdit: (email: string, seriesId: string, n: number) => ["creator", "episode-edit", email, seriesId, n] as const,
}

export const adminKeys = {
  all: ["admin"] as const,
  overview: (email?: string) => ["admin", "overview", email ?? ""] as const,
  list: (email: string | undefined, name: string, ...params: unknown[]) =>
    ["admin", "list", email ?? "", name, ...params] as const,
}

export const queryKeys = {
  catalog: catalogKeys,
  me: meKeys,
  wallet: walletKeys,
  comments: commentsKeys,
  creator: creatorKeys,
  admin: adminKeys,
}
