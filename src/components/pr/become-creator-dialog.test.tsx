import { useState } from "react"
import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { BecomeCreatorDialog } from "@/components/pr/become-creator-dialog"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

function Harness({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open creator</button>
      <BecomeCreatorDialog open={open} onOpenChange={setOpen} onDone={onDone} />
    </>
  )
}

async function open(onDone?: () => void) {
  useAppStore.getState().login({ name: "Sokha Chan", email: "sokha@example.com" })
  const view = renderUi(<Harness onDone={onDone} />)
  await view.user.click(screen.getByRole("button", { name: "Open creator" }))
  await screen.findByRole("dialog", { name: "Become a creator" })
  return view
}
const accept = (user: Awaited<ReturnType<typeof open>>["user"]) => user.click(screen.getByRole("button", { name: "Accept and continue" }))

const creatorHandlers = (onBody?: (b: unknown) => void) => [
  http.post(`${API}/creator`, async ({ request }) => {
    onBody?.(await request.json())
    return HttpResponse.json({ penName: "Sokha" }, { status: 201 })
  }),
  http.get(`${API}/me`, () => HttpResponse.json({ id: "u1", displayName: "Sokha Chan", email: "sokha@example.com", emailVerified: true, roles: ["READER", "CREATOR"], avatarUrl: null })),
]

describe("BecomeCreatorDialog: open and close", () => {
  it("opens with the pen name filled from the account name", async () => {
    await open()
    expect(screen.getByLabelText("Pen name")).toHaveValue("Sokha Chan")
  })

  it("closes with Cancel, Escape and the X, returning the focus to the opener", async () => {
    const { user } = await open()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open creator" }))
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open creator" }))
    await user.click(await screen.findByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("returns the focus to the button that opened it", async () => {
    const { user } = await open()
    await user.keyboard("{Escape}")
    expect(screen.getByRole("button", { name: "Open creator" })).toHaveFocus()
  })

  it("links to the creator guidelines", async () => {
    await open()
    expect(screen.getByRole("link", { name: "Read the creator guidelines" })).toHaveAttribute("href", "/creator#guidelines")
  })
})

describe("BecomeCreatorDialog: validation", () => {
  it("asks for the terms and sends nothing when the box is unticked", async () => {
    const { user } = await open()
    await accept(user)
    expect(await screen.findByText("Accept the terms to continue.")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("asks for a pen name when it is empty or only spaces", async () => {
    const { user } = await open()
    const field = screen.getByLabelText("Pen name")
    await user.clear(field)
    await user.type(field, "   ")
    await user.click(screen.getByRole("checkbox"))
    await accept(user)
    expect(await screen.findByText("Enter a pen name.")).toBeInTheDocument()
    expect(field).toHaveAttribute("aria-describedby", "pen-name-error")
  })

  it("rejects a pen name longer than 60 characters", async () => {
    const { user } = await open()
    const field = screen.getByLabelText("Pen name")
    await user.clear(field)
    await user.click(field)
    await user.paste("x".repeat(61))
    await user.click(screen.getByRole("checkbox"))
    await accept(user)
    expect(await screen.findByText("Use 60 characters or fewer.")).toBeInTheDocument()
  })
})

describe("BecomeCreatorDialog: submitting", () => {
  it("posts the trimmed pen name with the accepted terms, then closes and calls onDone", async () => {
    let body: unknown
    server.use(...creatorHandlers((b) => (body = b)))
    const onDone = vi.fn()
    const { user } = await open(onDone)
    const field = screen.getByLabelText("Pen name")
    await user.clear(field)
    await user.type(field, "  Sokha ")
    await user.click(screen.getByRole("checkbox"))
    await accept(user)
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(body).toEqual({ penName: "Sokha", acceptTerms: true })
    expect(toast.success).toHaveBeenCalledWith("You're a creator now.")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows the API's pen-name error on the field and stays open", async () => {
    server.use(http.post(`${API}/creator`, () => apiError(400, "validation_failed", { fields: { penName: "required" } })))
    const { user } = await open()
    await user.click(screen.getByRole("checkbox"))
    await accept(user)
    expect(await screen.findByText("Enter a pen name.")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("shows the wait time for a rate limit and the generic error otherwise", async () => {
    server.use(http.post(`${API}/creator`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 15 })))
    const { user } = await open()
    await user.click(screen.getByRole("checkbox"))
    await accept(user)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 15 seconds." })))
    server.use(http.post(`${API}/creator`, () => apiError(500, "internal_error")))
    await accept(user)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})
