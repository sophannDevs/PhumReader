import { useState } from "react"
import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { ReasonDialog, type ReasonAsk } from "@/components/pr/admin-dialogs"
import { ApiError } from "@/lib/api/client"
import { renderUi, screen, waitFor } from "@/test/render"

const makeAsk = (over: Partial<ReasonAsk> = {}): ReasonAsk => ({
  title: "Ban this account?",
  description: "The reader is signed out everywhere.",
  confirm: "Ban account",
  required: true,
  destructive: true,
  run: vi.fn().mockResolvedValue(undefined),
  done: "Account banned",
  ...over,
})

function Harness({ ask }: { ask: ReasonAsk }) {
  const [current, setCurrent] = useState<ReasonAsk | null>(null)
  return (
    <>
      <button onClick={() => setCurrent(ask)}>Open admin</button>
      <ReasonDialog ask={current} onClose={() => setCurrent(null)} />
    </>
  )
}

async function open(ask: ReasonAsk) {
  const view = renderUi(<Harness ask={ask} />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await view.user.click(screen.getByRole("button", { name: "Open admin" }))
  await screen.findByRole("dialog", { name: ask.title })
  return view
}

describe("ReasonDialog: open and close", () => {
  it("opens with the title and description, and closes with Cancel", async () => {
    const ask = makeAsk()
    const { user } = await open(ask)
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("The reader is signed out everywhere.")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(ask.run).not.toHaveBeenCalled()
  })

  it("closes with Escape and with the X", async () => {
    const { user } = await open(makeAsk())
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open admin" }))
    await user.click(await screen.findByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("ReasonDialog: the reason", () => {
  it("is required when the action needs one: blank or spaces show an error and run nothing", async () => {
    const ask = makeAsk()
    const { user } = await open(ask)
    await user.click(screen.getByRole("button", { name: "Ban account" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Write a reason.")
    await user.type(screen.getByLabelText("Reason"), "   ")
    await user.click(screen.getByRole("button", { name: "Ban account" }))
    expect(ask.run).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Reason")).toHaveAttribute("aria-invalid", "true")
  })

  it("is only a note when optional, and an empty note is allowed", async () => {
    const ask = makeAsk({ required: false, confirm: "Hide", destructive: false })
    const { user } = await open(ask)
    expect(screen.getByLabelText("Note (optional)")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Hide" }))
    await waitFor(() => expect(ask.run).toHaveBeenCalledWith(""))
  })

  it("hints that the reason is saved in the audit log", async () => {
    await open(makeAsk())
    expect(screen.getByText("Saved in the audit log.")).toBeInTheDocument()
  })

  it("stops typing at 500 characters", async () => {
    const { user } = await open(makeAsk())
    await user.click(screen.getByLabelText("Reason"))
    await user.paste("x".repeat(520))
    expect((screen.getByLabelText("Reason") as HTMLTextAreaElement).value).toHaveLength(500)
  })
})

describe("ReasonDialog: confirming", () => {
  it("runs the action with the trimmed reason, shows the success toast and closes", async () => {
    const ask = makeAsk()
    const { user } = await open(ask)
    await user.type(screen.getByLabelText("Reason"), "  spam  ")
    await user.click(screen.getByRole("button", { name: "Ban account" }))
    await waitFor(() => expect(ask.run).toHaveBeenCalledWith("spam"))
    expect(toast.success).toHaveBeenCalledWith("Account banned")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("keeps the dialog open and shows the specific message for a 409 the API explains", async () => {
    const ask = makeAsk({ run: vi.fn().mockRejectedValue(new ApiError(409, { code: "coins_spent" })) })
    const { user } = await open(ask)
    await user.type(screen.getByLabelText("Reason"), "refund")
    await user.click(screen.getByRole("button", { name: "Ban account" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("The reader already spent some of these coins")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("says the person has no access on a 403", async () => {
    const ask = makeAsk({ run: vi.fn().mockRejectedValue(new ApiError(403, { code: "forbidden" })) })
    const { user } = await open(ask)
    await user.type(screen.getByLabelText("Reason"), "x")
    await user.click(screen.getByRole("button", { name: "Ban account" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have access.")
  })

  it("falls back to the general message, and the button works again for a retry", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined)
    const { user } = await open(makeAsk({ run }))
    await user.type(screen.getByLabelText("Reason"), "x")
    await user.click(screen.getByRole("button", { name: "Ban account" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again.")
    await user.click(screen.getByRole("button", { name: "Ban account" }))
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2))
  })
})
