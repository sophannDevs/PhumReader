import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { UnlockDialog } from "@/components/pr/unlock-dialog"
import { renderUi, screen } from "@/test/render"

const episode = { n: 7, thumb: "/covers/x.svg", freeDate: "2026-12-01" }

type Props = Partial<React.ComponentProps<typeof UnlockDialog>>

/** A dialog that really opens and closes, behind an opener button, like the readers use it. */
function Harness(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open unlock</button>
      <UnlockDialog open={open} onOpenChange={setOpen} episode={episode} loggedIn balance={10} price={5} {...props} />
    </>
  )
}

async function open(props: Props = {}) {
  const view = renderUi(<Harness {...props} />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await view.user.click(screen.getByRole("button", { name: "Open unlock" }))
  return view
}

describe("UnlockDialog: open and close", () => {
  it("opens as a labelled dialog with the episode title and the free date", async () => {
    await open()
    const dialog = await screen.findByRole("dialog", { name: "Unlock episode 7" })
    expect(dialog).toHaveAccessibleDescription(/Free for everyone on/)
  })

  it("says Chapter for a web novel", async () => {
    await open({ kind: "chapter" })
    expect(await screen.findByRole("dialog", { name: "Unlock chapter 7" })).toBeInTheDocument()
  })

  it("closes with Wait for the free release and puts the focus back on the opener", async () => {
    const { user } = await open()
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("button", { name: "Wait for the free release" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open unlock" })).toHaveFocus()
  })

  it("closes with Escape", async () => {
    const { user } = await open()
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes with the X button", async () => {
    const { user } = await open()
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("keeps the focus inside while it is open", async () => {
    const { user } = await open()
    const dialog = await screen.findByRole("dialog")
    for (let i = 0; i < 6; i++) await user.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })
})

describe("UnlockDialog: the three states", () => {
  it("logged out: asks to log in and shows no balance", async () => {
    const onLogin = vi.fn()
    const { user } = await open({ loggedIn: false, onLogin })
    expect(await screen.findByText("Log in to unlock episodes and keep them on all your devices.")).toBeInTheDocument()
    expect(screen.queryByText("Your balance")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Unlock for/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Log in to unlock" }))
    expect(onLogin).toHaveBeenCalledOnce()
  })

  it("enough coins: shows the price and balance and unlocks", async () => {
    const onUnlock = vi.fn()
    const { user } = await open({ balance: 10, price: 5, onUnlock })
    expect(await screen.findByText("Your balance")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Unlock for 5 coins" }))
    expect(onUnlock).toHaveBeenCalledOnce()
  })

  it("exactly enough coins still unlocks", async () => {
    await open({ balance: 5, price: 5 })
    expect(await screen.findByRole("button", { name: "Unlock for 5 coins" })).toBeInTheDocument()
  })

  it("not enough coins: says how many more and offers Get coins", async () => {
    const onGetCoins = vi.fn()
    const { user } = await open({ balance: 2, price: 5, onGetCoins })
    expect(await screen.findByText(/You need 3 more coins\./)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Unlock for/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Get coins" }))
    expect(onGetCoins).toHaveBeenCalledOnce()
  })

  it("uses the singular for one coin", async () => {
    await open({ balance: 0, price: 1 })
    expect(await screen.findByText(/You need 1 more coin\./)).toBeInTheDocument()
  })

  it("shows a loading button while the unlock runs", async () => {
    await open({ loading: true })
    expect(await screen.findByRole("button", { name: /Unlock for 5 coins/ })).toBeDisabled()
  })
})

describe("UnlockDialog: the bundle", () => {
  const bundle = { count: 3, first: 7, last: 9, lastDate: "2026-12-15" }

  it("without a cost, prices the bundle at count × price", async () => {
    await open({ balance: 30, price: 5, bundle, mode: "all" })
    expect(await screen.findByRole("button", { name: "Unlock 3 episodes for 15 coins" })).toBeInTheDocument()
  })

  it("uses the bundle's own cost when episodes have their own prices (real API)", async () => {
    await open({ balance: 30, price: 7, bundle: { ...bundle, cost: 16 }, mode: "all" })
    expect(await screen.findByRole("button", { name: "Unlock 3 episodes for 16 coins" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /All 3 Fast Pass episodes/ })).toHaveTextContent("16")
    expect(screen.getByText("14 coins")).toBeInTheDocument() // after unlocking: 30 - 16
  })

  it("asks for the missing coins of the bundle's cost", async () => {
    await open({ balance: 10, price: 7, bundle: { ...bundle, cost: 16 }, mode: "all" })
    expect(await screen.findByText(/You need 6 more coins\./)).toBeInTheDocument()
  })
})
