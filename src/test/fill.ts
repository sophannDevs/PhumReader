import type { UserEvent } from "@testing-library/user-event"

/**
 * Fills a text field the quick way: a click (focus), then one paste (real paste, beforeinput and input events; the
 * field's maxLength applies as with typing). The value arrives unchanged, spaces included, in one change. Like
 * `user.type` it adds at the end of the current value and doesn't clear the field (unlike Playwright's `fill`): call
 * `user.clear(field)` first on a pre-filled field.
 * Use it instead of `user.type` where the test doesn't check what happens per key: `user.type` sends five events and
 * waits a timer tick per key, and watched or controlled fields re-render the form on each one (20–30 ms a key in jsdom
 * on the bigger forms), which pushed tests past Vitest's 5 s limit in the full suite.
 */
export async function fill(user: UserEvent, field: HTMLElement, value: string) {
  await user.click(field)
  await user.paste(value)
}
