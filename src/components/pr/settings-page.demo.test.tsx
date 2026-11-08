import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { SettingsPage } from "@/components/pr/settings-page"
import { useAppStore } from "@/lib/store"
import { renderUi, screen } from "@/test/render"

// The demo build (NEXT_PUBLIC_DEMO=1) is read when the module loads, so this file loads it as demo.
vi.mock("@/lib/api/config", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api/config")>()), DEMO_MODE: true }))

async function openReset() {
  useAppStore.getState().login({ name: "Demo", email: "reader@toonwave.app" })
  useAppStore.setState({ coins: 40, subscriptions: ["S1"] })
  const view = renderUi(<SettingsPage />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await view.user.click(screen.getByRole("button", { name: "Reset demo data" }))
  await screen.findByRole("dialog", { name: "Reset demo data?" })
  return view
}

describe("SettingsPage in the demo: Reset demo data", () => {
  it("does not show the real-account sections", () => {
    useAppStore.getState().login({ name: "Demo", email: "reader@toonwave.app" })
    renderUi(<SettingsPage />)
    expect(screen.queryByRole("heading", { name: "Security" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
  })

  it("closes with Cancel without clearing anything, and returns the focus", async () => {
    const { user } = await openReset()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(useAppStore.getState().coins).toBe(40)
    expect(screen.getByRole("button", { name: "Reset demo data" })).toHaveFocus()
  })

  it("closes with Escape and with the X", async () => {
    const { user } = await openReset()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Reset demo data" }))
    await user.click(await screen.findByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(useAppStore.getState().coins).toBe(40)
  })

  it("resets the stored demo state, signs out, says so and closes", async () => {
    const { user } = await openReset()
    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(toast.success).toHaveBeenCalledWith("Demo data reset")
    expect(useAppStore.getState().coins).toBe(0)
    expect(useAppStore.getState().subscriptions).toEqual([])
    expect(useAppStore.getState().user).toBeNull()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
