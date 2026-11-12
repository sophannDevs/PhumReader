import { screen } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"

/**
 * Picks an option of a `NativeSelect` (the animated Radix Select) by its value, the way a reader does:
 * opens the list from the trigger, then clicks the option. Stands in for `user.selectOptions` on a native <select>.
 */
export async function selectOption(user: UserEvent, trigger: HTMLElement, value: string) {
  await user.click(trigger)
  const listbox = await screen.findByRole("listbox")
  const option = listbox.querySelector<HTMLElement>(`[role="option"][data-value=${JSON.stringify(value)}]`)
  if (!option) throw new Error(`No option with the value ${JSON.stringify(value)}`)
  await user.click(option)
}
