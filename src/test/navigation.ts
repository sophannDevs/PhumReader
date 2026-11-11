import { vi } from "vitest"

/**
 * Stand-ins for Next.js and next-intl routing, which need the Next.js runtime.
 * Tests read and set them through the exports here.
 */
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

export const nav = { pathname: "/", search: "" }

/** Set the query string the component sees, e.g. `setSearch("social=done")`. */
export function setSearch(search: string) {
  nav.search = search
}

export const resetNavigation = () => {
  nav.pathname = "/"
  nav.search = ""
  Object.values(router).forEach((fn) => fn.mockReset())
}

export const useSearchParams = () => new URLSearchParams(nav.search)
export const usePathname = () => nav.pathname
export const useRouter = () => router
export const redirect = vi.fn()
