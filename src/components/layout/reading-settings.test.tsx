import { describe, expect, it } from "vitest"
import { ReadingSettingsControls, ReadingSettingsPopover, TEXT_SIZES } from "@/components/layout/reading-settings"
import { useAppStore } from "@/lib/store"
import { renderUi, screen } from "@/test/render"

const settings = () => useAppStore.getState().novelSettings
/** The reader's own choice (after that it no longer follows Settings). */
const custom = (patch: Partial<ReturnType<typeof settings>>) =>
  useAppStore.setState((s) => ({ novelSettings: { ...s.novelSettings, ...patch }, novelCustom: true }))

describe("ReadingSettingsControls", () => {
  it("follows the text size preset of Settings until the reader picks their own", () => {
    useAppStore.setState((s) => ({ settings: { ...s.settings, size: "xl" } }))
    renderUi(<ReadingSettingsControls />)
    expect(screen.getByText("22 px")).toBeInTheDocument()
  })

  it("shows the stored size", () => {
    custom({ size: 20 })
    renderUi(<ReadingSettingsControls />)
    expect(screen.getByText("20 px")).toBeInTheDocument()
  })

  it("steps the size up and down through the allowed sizes", async () => {
    const { user } = renderUi(<ReadingSettingsControls />)
    await user.click(screen.getByRole("button", { name: "Bigger text" }))
    expect(settings().size).toBe(20)
    await user.click(screen.getByRole("button", { name: "Smaller text" }))
    await user.click(screen.getByRole("button", { name: "Smaller text" }))
    expect(settings().size).toBe(16)
    expect(screen.getByText("16 px")).toBeInTheDocument()
  })

  it("disables Decrease at the smallest size and Increase at the largest", async () => {
    custom({ size: TEXT_SIZES[0] })
    const { rerender } = renderUi(<ReadingSettingsControls />)
    expect(screen.getByRole("button", { name: "Smaller text" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Bigger text" })).toBeEnabled()
    custom({ size: TEXT_SIZES[TEXT_SIZES.length - 1] })
    rerender(<ReadingSettingsControls />)
    expect(screen.getByRole("button", { name: "Bigger text" })).toBeDisabled()
  })

  it("switches the theme and the font", async () => {
    const { user } = renderUi(<ReadingSettingsControls />)
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Sepia" }))
    expect(settings().theme).toBe("sepia")
    await user.click(screen.getByRole("radio", { name: "Dark" }))
    expect(settings().theme).toBe("dark")
    await user.click(screen.getByRole("radio", { name: "Serif" }))
    expect(settings().font).toBe("serif")
    await user.click(screen.getByRole("radio", { name: "Sans" }))
    expect(settings().font).toBe("sans")
  })

  it("toggles wide line spacing from the label as well as the switch", async () => {
    const { user } = renderUi(<ReadingSettingsControls />)
    const toggle = screen.getByRole("switch", { name: "Wide line spacing" })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(settings().wide).toBe(false)
    await user.click(screen.getByText("Wide line spacing"))
    expect(settings().wide).toBe(true)
  })

  it("works with the keyboard", async () => {
    const { user } = renderUi(<ReadingSettingsControls />)
    screen.getByRole("button", { name: "Bigger text" }).focus()
    await user.keyboard("{Enter}")
    expect(settings().size).toBe(20)
    await user.keyboard(" ")
    expect(settings().size).toBe(22)
  })
})

describe("ReadingSettingsPopover", () => {
  it("opens from the Aa button, carries the theme, and closes with Escape", async () => {
    custom({ theme: "sepia" })
    const { user } = renderUi(<ReadingSettingsPopover />)
    const trigger = screen.getByRole("button", { name: "Reading settings" })
    expect(screen.queryByText("Text size")).not.toBeInTheDocument()
    await user.click(trigger)
    expect(await screen.findByText("Text size")).toBeInTheDocument()
    expect(document.querySelector("[data-reader-theme=sepia]")).not.toBeNull()
    await user.keyboard("{Escape}")
    expect(screen.queryByText("Text size")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("changes the stored setting from inside the popover", async () => {
    const { user } = renderUi(<ReadingSettingsPopover />)
    await user.click(screen.getByRole("button", { name: "Reading settings" }))
    await user.click(await screen.findByRole("radio", { name: "Dark" }))
    expect(settings().theme).toBe("dark")
  })
})
