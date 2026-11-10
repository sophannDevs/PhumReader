import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import type { ReactElement, ReactNode } from "react"
import { ThemeProvider } from "@/lib/theme"
import en from "@/messages/en"
import km from "@/messages/km"

const messages = { en, km } as const

/**
 * Render a component the way the app does: next-intl (real messages, English by default), TanStack
 * Query (no retries, so an error shows at once) and a clean store. Returns a `user` for typing and clicking.
 */
export function renderUi(ui: ReactElement, { locale = "en", ...options }: { locale?: "en" | "km" } & Omit<RenderOptions, "wrapper"> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Phnom_Penh">
      <QueryClientProvider client={client}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  )
  return { user: userEvent.setup(), client, ...render(ui, { wrapper: Wrapper, ...options }) }
}

export { screen, waitFor, within } from "@testing-library/react"
