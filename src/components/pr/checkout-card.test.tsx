import { describe, expect, it, vi } from "vitest"
import { CheckoutCard } from "@/components/pr/checkout-card"
import type { Flow } from "@/components/pr/checkout-flow"
import type { Checkout } from "@/lib/api/coins"
import { useAppStore } from "@/lib/store"
import { router } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"

const pack = { coins: 30, bonus: 3, tag: null, priceUSD: "[PRICE USD]", priceKHR: "[PRICE KHR]" }
const khqr = { id: "khqr", label: "KHQR", desc: "Scan with any Bakong-member bank app" } as never
const aba = { id: "aba", label: "ABA Pay", desc: "Confirm in the ABA Mobile app" } as never
const card = { id: "card", label: "Credit or debit card", desc: "Visa, Mastercard" } as never

function setup(flow: Flow, over: Partial<React.ComponentProps<typeof CheckoutCard>> = {}) {
  const handlers = { onContinue: vi.fn(), onCancel: vi.fn(), onSubmit: vi.fn(), onReset: vi.fn() }
  const view = renderUi(<CheckoutCard flow={flow} remaining={125} pack={pack} method={khqr} offer={false} expiryMinutes={10} {...handlers} {...over} />)
  return { ...view, ...handlers }
}
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
const real = (over: Partial<Checkout> = {}): Checkout => ({ qrImage: null, qrString: null, abaDeeplink: null, formAction: null, formFields: null, ...over })

describe("CheckoutCard: review", () => {
  it("shows the pack, the bonus, the total and the balance afterwards", () => {
    useAppStore.setState({ coins: 7 })
    setup({ step: "review" })
    expect(screen.getByRole("heading", { name: "Order summary" })).toBeInTheDocument()
    expect(screen.getByText("30 coin pack")).toBeInTheDocument()
    expect(screen.getByText("Pack bonus")).toBeInTheDocument()
    expect(screen.getByText("+3")).toBeInTheDocument()
    expect(screen.getByText("33 coins")).toBeInTheDocument()
    expect(screen.getByText("[PRICE USD]")).toBeInTheDocument()
    expect(screen.getByText("Paying with").nextElementSibling).toHaveTextContent("KHQR")
    expect(screen.getByText(/Balance after: 40 coins/)).toBeInTheDocument()
  })

  it("adds the first-purchase bonus to what the reader gets", () => {
    setup({ step: "review" }, { offer: true })
    expect(screen.getByText("First-purchase bonus")).toBeInTheDocument()
    expect(screen.getByText("63 coins")).toBeInTheDocument()
  })

  it("hides the pack bonus row for a pack without one", () => {
    setup({ step: "review" }, { pack: { ...pack, bonus: 0 } })
    expect(screen.queryByText("Pack bonus")).not.toBeInTheDocument()
  })

  it("logged out: Continue sends the reader to log in and remembers /coins", async () => {
    const { user, onContinue } = setup({ step: "review" })
    await user.click(screen.getByRole("button", { name: "Continue to payment" }))
    expect(router.push).toHaveBeenCalledWith("/login")
    expect(useAppStore.getState().returnTo).toBe("/coins")
    expect(onContinue).not.toHaveBeenCalled()
  })

  it("logged in: Continue starts the payment, and is disabled while the order is being made", async () => {
    signIn()
    const { user, onContinue, rerender } = setup({ step: "review" })
    await user.click(screen.getByRole("button", { name: "Continue to payment" }))
    expect(onContinue).toHaveBeenCalledOnce()
    rerender(<CheckoutCard flow={{ step: "review" }} remaining={0} pack={pack} method={khqr} offer={false} expiryMinutes={10} onContinue={onContinue} onCancel={vi.fn()} onSubmit={vi.fn()} onReset={vi.fn()} starting />)
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeDisabled()
  })
})

describe("CheckoutCard: pay", () => {
  const pay: Flow = { step: "pay", deadline: 0 }

  it("shows the KHQR placeholder and a countdown for the demo", () => {
    setup(pay)
    expect(screen.getByRole("heading", { name: "Scan to pay" })).toBeInTheDocument()
    expect(screen.getByText("[KHQR PLACEHOLDER] · PhumiReader")).toBeInTheDocument()
    expect(screen.getByRole("timer")).toHaveTextContent("Code expires in 2:05")
    expect(screen.getByText("[PRICE KHR]")).toBeInTheDocument()
  })

  it("shows PayWay's real QR code, the price in dollars, and waits instead of offering a fake Paid button", () => {
    setup(pay, { checkout: real({ qrImage: "data:image/png;base64,AAAA" }) })
    expect(screen.getByRole("img", { name: "KHQR code to scan and pay" })).toHaveAttribute("src", "data:image/png;base64,AAAA")
    expect(screen.getByText("[PRICE USD]")).toBeInTheDocument()
    expect(screen.getByText("Waiting for your payment…")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /I've paid/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Simulate failed payment" })).not.toBeInTheDocument()
  })

  it("ABA Pay: a placeholder in the demo, and an Open ABA Mobile link with the real deeplink", () => {
    const { unmount } = setup(pay, { method: aba })
    expect(screen.getByRole("heading", { name: "Confirm in ABA Mobile" })).toBeInTheDocument()
    expect(screen.getByText("[ABA PAY HANDOFF PLACEHOLDER]")).toBeInTheDocument()
    unmount()
    setup(pay, { method: aba, checkout: real({ abaDeeplink: "abamobilebank://pay?id=1" }) })
    expect(screen.getByRole("link", { name: "Open ABA Mobile" })).toHaveAttribute("href", "abamobilebank://pay?id=1")
  })

  it("never has a card number field: the demo shows a placeholder, the real flow goes to PayWay's page", () => {
    const { unmount } = setup(pay, { method: card })
    expect(screen.getByText("[PAYMENT PROVIDER FORM]")).toBeInTheDocument()
    expect(document.querySelector("input")).toBeNull()
    unmount()
    const { container } = setup(pay, { method: card, checkout: real({ formAction: "https://checkout.example/pay", formFields: { hash: "abc", tran_id: "PR-1" } }) })
    const form = container.querySelector("form") as HTMLFormElement
    expect(form).toHaveAttribute("action", "https://checkout.example/pay")
    expect(form).toHaveAttribute("method", "post")
    expect(form).toHaveAttribute("target", "_blank")
    const fields = [...form.querySelectorAll("input")]
    expect(fields.every((i) => i.type === "hidden")).toBe(true)
    expect(fields.map((i) => [i.name, i.value])).toEqual([["hash", "abc"], ["tran_id", "PR-1"]])
    expect(screen.getByRole("button", { name: "Pay now" })).toHaveAttribute("type", "submit")
  })

  it("the demo offers I've paid and Simulate failed payment, and Cancel", async () => {
    const { user, onSubmit, onCancel } = setup(pay)
    await user.click(screen.getByRole("button", { name: "I've paid (simulate)" }))
    expect(onSubmit).toHaveBeenLastCalledWith("success")
    await user.click(screen.getByRole("button", { name: "Simulate failed payment" }))
    expect(onSubmit).toHaveBeenLastCalledWith("failed")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("hides Simulate failed payment when simulating is off", () => {
    setup(pay, { canSimulate: false })
    expect(screen.queryByRole("button", { name: "Simulate failed payment" })).not.toBeInTheDocument()
  })

  it("a card pays with Pay now in the demo", async () => {
    const { user, onSubmit } = setup(pay, { method: card })
    await user.click(screen.getByRole("button", { name: "Pay now" }))
    expect(onSubmit).toHaveBeenCalledWith("success")
  })
})

describe("CheckoutCard: confirming, success and failed", () => {
  it("confirming says so, politely", () => {
    setup({ step: "confirming" })
    expect(screen.getByText("Confirming payment…").closest("[aria-live=polite]")).not.toBeNull()
  })

  it("success shows the coins, the new balance and the order, and Buy more resets", async () => {
    const { user, onReset } = setup({ step: "success", orderId: "PR-100", added: 33, balance: 40, method: "khqr" })
    expect(screen.getByRole("heading", { name: "+33 coins" })).toBeInTheDocument()
    expect(screen.getByText(/Payment received\. Your balance is now/)).toBeInTheDocument()
    expect(screen.getByText(/Order PR-100 · KHQR/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Back to/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Buy more coins" }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it("success after being sent from an episode offers a way back, and keeps the waiting unlock", async () => {
    useAppStore.getState().setShopReturn({ page: "/series/glass-compass", episode: 4, title: "Glass Compass" })
    useAppStore.getState().setPendingUnlock({ seriesId: "S1", episode: 4 })
    const { user } = setup({ step: "success", orderId: "PR-100", added: 33, balance: 40, method: "khqr" })
    await user.click(screen.getByRole("button", { name: "Back to episode 4 of Glass Compass" }))
    expect(router.push).toHaveBeenCalledWith("/series/glass-compass")
    expect(useAppStore.getState().shopReturn).toBeNull()
    expect(useAppStore.getState().pendingUnlock).toEqual({ seriesId: "S1", episode: 4 })
  })

  it("success says chapter when the reader came from a web novel", () => {
    useAppStore.getState().setShopReturn({ page: "/series/the-last-archivist", episode: 2, title: "The Last Archivist" })
    setup({ step: "success", orderId: "PR-1", added: 5, balance: 5, method: "aba" })
    expect(screen.getByRole("button", { name: "Back to chapter 2 of The Last Archivist" })).toBeInTheDocument()
  })

  it("a declined payment says so, with Try again and Choose another method", async () => {
    const { user, onContinue, onReset } = setup({ step: "failed", reason: "declined" })
    expect(screen.getByRole("alert")).toHaveTextContent("Payment didn’t go through")
    expect(screen.getByText("Your bank declined the payment. No coins were charged.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(onContinue).toHaveBeenCalledOnce()
    await user.click(screen.getByRole("button", { name: "Choose another method" }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it("an expired code says how long codes last", () => {
    setup({ step: "failed", reason: "expired" }, { expiryMinutes: 10 })
    expect(screen.getByRole("heading", { name: "The code expired" })).toBeInTheDocument()
    expect(screen.getByText("KHQR codes are valid for 10 minutes. Make a new one to try again.")).toBeInTheDocument()
  })
})
