import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { createElement, type AnchorHTMLAttributes } from "react"
import { afterAll, afterEach, beforeAll, vi } from "vitest"
import { clearAuthDraft } from "@/components/auth/auth-draft"
import { useAppStore } from "@/lib/store"
import { resetNavigation } from "./navigation"
import { defaultHandlers, server } from "./server"

// ---- routing: Next.js and next-intl need the Next.js runtime, so tests get plain stand-ins
vi.mock("next/navigation", async () => {
  const nav = await import("./navigation")
  return { useSearchParams: nav.useSearchParams, usePathname: nav.usePathname, useRouter: nav.useRouter, redirect: nav.redirect, notFound: vi.fn() }
})
vi.mock("@/i18n/navigation", async () => {
  const nav = await import("./navigation")
  return {
    Link: ({ href, children, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname: string } }) =>
      createElement("a", { href: typeof href === "string" ? href : href.pathname, ...rest }, children),
    usePathname: nav.usePathname,
    useRouter: nav.useRouter,
    redirect: nav.redirect,
    getPathname: ({ href }: { href: string }) => href,
  }
})

// ---- toasts: the tests read what was shown
vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  })
  return { toast, Toaster: () => null }
})

// ---- the browser APIs jsdom lacks (Radix, cmdk and the readers use them)
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia
document.elementFromPoint ??= () => null
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}

// ---- the API client calls "/api/v1/..." (same origin in a browser); Node's fetch needs an absolute URL
// eslint-disable-next-line no-restricted-properties -- test setup wraps fetch so relative API URLs work in Node
const nativeFetch = globalThis.fetch
// eslint-disable-next-line no-restricted-properties -- same wrapper
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  nativeFetch(typeof input === "string" && input.startsWith("/") ? new URL(input, window.location.origin).href : input, init)) as typeof fetch

const initialStore = useAppStore.getInitialState()
// The app loads the stored state after the first render (StoreHydrator); tests start hydrated.
void useAppStore.persist.rehydrate()

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => {
  cleanup()
  server.resetHandlers(...defaultHandlers)
  resetNavigation()
  clearAuthDraft()
  localStorage.clear()
  document.documentElement.classList.remove("dark")
  document.cookie.split("; ").forEach((c) => (document.cookie = `${c.split("=")[0]}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`))
  useAppStore.setState(initialStore, true)
})
afterAll(() => server.close())
