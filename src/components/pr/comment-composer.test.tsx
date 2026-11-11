import { useState } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CommentComposer, ThreadComposer } from "@/components/pr/comment-composer"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor } from "@/test/render"

function Harness({ onSubmit, max }: { onSubmit: (text: string) => void; max?: number }) {
  const [value, setValue] = useState("")
  return <CommentComposer value={value} onChange={setValue} onSubmit={() => onSubmit(value)} max={max} />
}

describe("CommentComposer", () => {
  beforeEach(() => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" }))

  it("has a labelled box, the hint and a counter starting at 0/500", () => {
    renderUi(<Harness onSubmit={vi.fn()} />)
    expect(screen.getByLabelText("Add a comment")).toHaveAttribute("placeholder", "What did you think?")
    expect(screen.getByText("0/500")).toBeInTheDocument()
    expect(screen.getByText(/Be kind\. Spoilers go in a spoiler tag\./)).toBeInTheDocument()
    expect(screen.getByLabelText("Add a comment")).toHaveAccessibleDescription(/0\/500/)
  })

  it("invites a signed-out visitor to log in, and does not submit", async () => {
    useAppStore.getState().logout()
    const onSubmit = vi.fn()
    const { user } = renderUi(<Harness onSubmit={onSubmit} />)
    expect(screen.getByLabelText("Add a comment")).toHaveAttribute("placeholder", "Log in to join the conversation")
    await user.type(screen.getByLabelText("Add a comment"), "Hi")
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(toast.message).toHaveBeenCalledWith("Log in to comment")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("says to write something first for an empty comment or only spaces", async () => {
    const onSubmit = vi.fn()
    const { user } = renderUi(<Harness onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(toast.message).toHaveBeenCalledWith("Write something first")
    await user.type(screen.getByLabelText("Add a comment"), "   ")
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(toast.message).toHaveBeenCalledTimes(2)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("counts the characters as the reader types, and stops at the limit", async () => {
    const { user } = renderUi(<Harness onSubmit={vi.fn()} max={10} />)
    await user.type(screen.getByLabelText("Add a comment"), "abcdefghijKLM")
    expect(screen.getByLabelText("Add a comment")).toHaveValue("abcdefghij")
    expect(screen.getByText("10/10")).toBeInTheDocument()
  })

  it("submits with the Post button, also from the keyboard, and Enter in the box only adds a new line", async () => {
    const onSubmit = vi.fn()
    const { user } = renderUi(<Harness onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText("Add a comment"), "Great")
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(onSubmit).toHaveBeenCalledWith("Great")
    screen.getByRole("button", { name: "Post" }).focus()
    await user.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(2)
    await user.type(screen.getByLabelText("Add a comment"), "{Enter}more")
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Great\nmore")
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })
})

describe("ThreadComposer", () => {
  it("asks a signed-out visitor to log in and remembers the page", async () => {
    const { user } = renderUi(<ThreadComposer onPost={vi.fn()} />)
    expect(screen.getByText("Log in to join the conversation.")).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Log in" }))
    expect(useAppStore.getState().returnTo).toBe("/")
  })

  it("keeps Post disabled until there is text, posts with the spoiler flag and then clears", async () => {
    useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
    const onPost = vi.fn().mockResolvedValue(true)
    const { user } = renderUi(<ThreadComposer onPost={onPost} />)
    const post = screen.getByRole("button", { name: "Post" })
    expect(post).toBeDisabled()
    await user.type(screen.getByLabelText("Your comment"), "Great  ")
    await user.click(screen.getByRole("checkbox", { name: "Contains spoilers" }))
    await user.click(post)
    expect(onPost).toHaveBeenCalledWith("Great  ", true)
    await waitFor(() => expect(screen.getByLabelText("Your comment")).toHaveValue(""))
    expect(screen.getByRole("checkbox", { name: "Contains spoilers" })).not.toBeChecked()
  })

  it("keeps what was typed when posting fails", async () => {
    useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
    const onPost = vi.fn().mockResolvedValue(false)
    const { user } = renderUi(<ThreadComposer onPost={onPost} />)
    await user.type(screen.getByLabelText("Your comment"), "Hello")
    await user.click(screen.getByRole("button", { name: "Post" }))
    await waitFor(() => expect(onPost).toHaveBeenCalled())
    expect(screen.getByLabelText("Your comment")).toHaveValue("Hello")
  })
})
