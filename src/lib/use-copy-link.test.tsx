import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useCopyLink } from "@/lib/use-copy-link"
import { renderUi, screen } from "@/test/render"

function ShareButton(props: Parameters<typeof useCopyLink>[0]) {
  const share = useCopyLink(props)
  return (
    <button type="button" onClick={share}>
      Share
    </button>
  )
}

/** Stands in for the browser clipboard (set after renderUi: user-event installs its own stub). */
function mockClipboard(writeText: (text: string) => Promise<void>) {
  const spy = vi.fn(writeText)
  Object.defineProperty(navigator, "clipboard", { value: { writeText: spy }, configurable: true })
  return spy
}

describe("useCopyLink", () => {
  afterEach(() => window.history.replaceState(null, "", "/"))

  it("copies the current address and says the link was copied", async () => {
    window.history.replaceState(null, "", "/series/glass-compass?tab=episodes")
    const { user } = renderUi(<ShareButton />)
    const writeText = mockClipboard(() => Promise.resolve())

    await user.click(screen.getByRole("button", { name: "Share" }))
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/series/glass-compass?tab=episodes")
    expect(toast.success).toHaveBeenCalledWith("Link copied")
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("copies the given link with the given message", async () => {
    window.history.replaceState(null, "", "/creators/mina-sok?tab=about")
    const { user } = renderUi(
      <ShareButton url={() => `${window.location.origin}${window.location.pathname}`} successKey="profile.linkCopied" />,
      { locale: "km" }
    )
    const writeText = mockClipboard(() => Promise.resolve())

    await user.click(screen.getByRole("button", { name: "Share" }))
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/creators/mina-sok")
    expect(toast.success).toHaveBeenCalledWith("បានចម្លងតំណប្រវត្តិរូប")
  })

  it("says the link couldn't be copied when the clipboard refuses", async () => {
    const { user } = renderUi(<ShareButton />)
    mockClipboard(() => Promise.reject(new Error("denied")))

    await user.click(screen.getByRole("button", { name: "Share" }))
    expect(toast.error).toHaveBeenCalledWith("Couldn't copy the link")
    expect(toast.success).not.toHaveBeenCalled()
  })
})
