import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { CommentComposer } from "@/components/pr/comment-composer"
import { renderUi, screen } from "@/test/render"

function Harness({ onSubmit, max }: { onSubmit: (text: string) => void; max?: number }) {
  const [value, setValue] = useState("")
  return <CommentComposer value={value} onChange={setValue} onSubmit={() => onSubmit(value)} max={max} />
}

describe("CommentComposer", () => {
  it("has a labelled box, the hint and a counter starting at 0/500", () => {
    renderUi(<Harness onSubmit={vi.fn()} />)
    expect(screen.getByLabelText("Add a comment")).toHaveAttribute("placeholder", "What did you think?")
    expect(screen.getByText("0/500")).toBeInTheDocument()
    expect(screen.getByText(/Be kind\. Spoilers go in a spoiler tag\./)).toBeInTheDocument()
    expect(screen.getByLabelText("Add a comment")).toHaveAccessibleDescription(/0\/500/)
  })

  it("keeps Post disabled for an empty comment or only spaces", async () => {
    const { user } = renderUi(<Harness onSubmit={vi.fn()} />)
    const post = screen.getByRole("button", { name: "Post" })
    expect(post).toBeDisabled()
    await user.type(screen.getByLabelText("Add a comment"), "   ")
    expect(post).toBeDisabled()
    await user.type(screen.getByLabelText("Add a comment"), "Hi")
    expect(post).toBeEnabled()
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

  it("does not submit a blank comment even if the form is submitted another way", async () => {
    const onSubmit = vi.fn()
    const { container } = renderUi(<Harness onSubmit={onSubmit} />)
    container.querySelector("form")?.requestSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
