import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { SeriesForm } from "@/components/pr/series-form"
import type { SeriesEdit } from "@/lib/api/creator"
import { router } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

// A server action that clears Next.js caches; it needs the Next.js runtime.
vi.mock("@/lib/actions/revalidate", () => ({ revalidateCatalogTags: vi.fn().mockResolvedValue(undefined) }))

const saved = (over: Partial<SeriesEdit> = {}): SeriesEdit => ({
  id: "11111111-1111-1111-1111-111111111111",
  slug: "my-series",
  type: "comic",
  title: "My series",
  genre: "fantasy",
  languages: ["en"],
  summary: "A story.",
  tags: ["sea"],
  ageRating: "all",
  status: "ongoing",
  updateDay: null,
  visibility: "draft",
  coverUrl: "http://localhost:9000/cover.webp",
  bannerUrl: null,
  ...over,
})

type User = ReturnType<typeof renderUi>["user"]
const buttons = {
  draft: () => screen.getByRole("button", { name: "Save draft" }),
  publish: () => screen.getByRole("button", { name: "Publish" }),
}
const tagInput = () => screen.getByRole("textbox", { name: "Tags" })

async function addTags(user: User, ...tags: string[]) {
  for (const tag of tags) {
    await user.clear(tagInput())
    await user.type(tagInput(), `${tag}{Enter}`)
  }
}

describe("SeriesForm: new series", () => {
  it("starts as a comic in English with Save draft and Publish, and no story status", () => {
    renderUi(<SeriesForm />)
    expect(screen.getByRole("radio", { name: "Comic" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Comic" })).toBeEnabled()
    expect(screen.getByRole("checkbox", { name: "English" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "ខ្មែរ (Khmer)" })).not.toBeChecked()
    expect(screen.queryByLabelText("Story status")).not.toBeInTheDocument()
    expect(buttons.draft()).toBeInTheDocument()
    expect(buttons.publish()).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument()
  })

  it("needs a title and a genre to save a draft, and sends nothing", async () => {
    const { user } = renderUi(<SeriesForm />)
    await user.click(buttons.draft())
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument()
    expect(screen.getByText("Choose a genre.")).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true")
    expect(router.push).not.toHaveBeenCalled()
  })

  it("rejects a title of only spaces", async () => {
    const { user } = renderUi(<SeriesForm />)
    await user.type(screen.getByLabelText("Title"), "    ")
    await user.click(buttons.draft())
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument()
  })

  it("needs at least one language", async () => {
    const { user } = renderUi(<SeriesForm />)
    await user.click(screen.getByRole("checkbox", { name: "English" }))
    await user.click(buttons.draft())
    expect(await screen.findByText("Choose at least one language.")).toBeInTheDocument()
  })

  it("counts the title and summary characters, and caps them at 120 and 2000", async () => {
    const { user } = renderUi(<SeriesForm />)
    await user.type(screen.getByLabelText("Title"), "Sea")
    expect(screen.getByText("3/120")).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveAttribute("maxlength", "120")
    expect(screen.getByLabelText("Summary")).toHaveAttribute("maxlength", "2000")
    expect(screen.getByText("0/2000")).toBeInTheDocument()
  })

  describe("tags", () => {
    it("adds a tag with Enter, a comma or the Add button, lowercased and without duplicates", async () => {
      const { user } = renderUi(<SeriesForm />)
      await user.type(tagInput(), "Sea{Enter}")
      await user.type(tagInput(), "mystery,")
      await user.type(tagInput(), "SEA")
      await user.click(screen.getByRole("button", { name: "Add" }))
      const list = screen.getByRole("list", { name: "Tags" })
      expect(list.textContent).toContain("sea")
      expect(list.textContent).toContain("mystery")
      expect(list.querySelectorAll("li")).toHaveLength(2)
      expect(tagInput()).toHaveValue("")
    })

    it("ignores an empty tag", async () => {
      const { user } = renderUi(<SeriesForm />)
      await user.type(tagInput(), "   {Enter}")
      expect(screen.queryByRole("list", { name: "Tags" })).not.toBeInTheDocument()
    })

    it("removes a tag with its button", async () => {
      const { user } = renderUi(<SeriesForm />)
      await addTags(user, "sea", "mystery")
      await user.click(screen.getByRole("button", { name: "Remove tag sea" }))
      expect(screen.queryByRole("button", { name: "Remove tag sea" })).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Remove tag mystery" })).toBeInTheDocument()
    })

    it("refuses a tag over 30 characters", async () => {
      const { user } = renderUi(<SeriesForm />)
      await user.type(tagInput(), "x".repeat(31))
      await user.click(screen.getByRole("button", { name: "Add" }))
      expect(await screen.findByText("A tag can have 30 characters at most.")).toBeInTheDocument()
    })

    it("refuses an 11th tag", async () => {
      const { user } = renderUi(<SeriesForm />)
      await addTags(user, ...Array.from({ length: 10 }, (_, i) => `tag${i}`))
      await user.type(tagInput(), "one-more{Enter}")
      expect(await screen.findByText("You can add up to 10 tags.")).toBeInTheDocument()
      expect(screen.getByRole("list", { name: "Tags" }).querySelectorAll("li")).toHaveLength(10)
    })
  })

  it("saves a draft: posts the cleaned values, says so, and goes to My series with a notice", async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${API}/creator/series`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json(saved({ title: "Sea Light" }), { status: 201 })
      }),
    )
    const { user } = renderUi(<SeriesForm />)
    await user.type(screen.getByLabelText("Title"), "  Sea Light  ")
    await user.selectOptions(screen.getByLabelText("Genre"), "fantasy")
    await user.click(screen.getByRole("checkbox", { name: "ខ្មែរ (Khmer)" }))
    await user.selectOptions(screen.getByLabelText("Update schedule"), "Mon")
    await user.click(screen.getByRole("radio", { name: /Teen/ }))
    await addTags(user, "Sea")
    await user.click(buttons.draft())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Draft saved."))
    expect(body).toEqual({
      title: "Sea Light",
      type: "comic",
      genre: "fantasy",
      languages: ["en", "km"],
      summary: "",
      ageRating: "teen",
      updateDay: "Mon",
      status: "ongoing",
      tags: ["sea"],
      coverUploadId: null,
      bannerUploadId: null,
    })
    expect(router.push).toHaveBeenCalledWith("/creator/series?notice=series-created&series=11111111-1111-1111-1111-111111111111")
  })

  it("can start a web novel", async () => {
    let type = ""
    server.use(
      http.post(`${API}/creator/series`, async ({ request }) => {
        type = ((await request.json()) as { type: string }).type
        return HttpResponse.json(saved({ type: "novel" }), { status: 201 })
      }),
    )
    const { user } = renderUi(<SeriesForm />)
    await user.click(screen.getByRole("radio", { name: "Web novel" }))
    await user.type(screen.getByLabelText("Title"), "Night Tide")
    await user.selectOptions(screen.getByLabelText("Genre"), "drama")
    await user.click(buttons.draft())
    await waitFor(() => expect(router.push).toHaveBeenCalled())
    expect(type).toBe("novel")
  })

  it("Publish also needs a summary, a cover and the terms, and sends nothing", async () => {
    const { user } = renderUi(<SeriesForm />)
    await user.type(screen.getByLabelText("Title"), "Sea Light")
    await user.selectOptions(screen.getByLabelText("Genre"), "fantasy")
    await user.click(buttons.publish())
    expect(await screen.findByText("Write a summary to publish.")).toBeInTheDocument()
    expect(screen.getByText("Add a cover to publish.")).toBeInTheDocument()
    expect(screen.getByText("Accept the terms to publish.")).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("clears the terms error once the box is ticked", async () => {
    const { user } = renderUi(<SeriesForm />)
    await user.type(screen.getByLabelText("Title"), "Sea Light")
    await user.selectOptions(screen.getByLabelText("Genre"), "fantasy")
    await user.click(buttons.publish())
    await screen.findByText("Accept the terms to publish.")
    await user.click(screen.getByRole("checkbox", { name: /I own this work/ }))
    expect(screen.queryByText("Accept the terms to publish.")).not.toBeInTheDocument()
  })

  it("links to the creator guidelines and back to My series", () => {
    renderUi(<SeriesForm />)
    expect(screen.getByRole("link", { name: "Read the creator guidelines" })).toHaveAttribute("href", "/creator#guidelines")
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/creator/series")
  })
})

describe("SeriesForm: errors from the API", () => {
  async function submitDraft(status: number, code: string, extra: Record<string, unknown> = {}) {
    server.use(http.post(`${API}/creator/series`, () => apiError(status, code, extra)))
    const view = renderUi(<SeriesForm />)
    await view.user.type(screen.getByLabelText("Title"), "Sea Light")
    await view.user.selectOptions(screen.getByLabelText("Genre"), "fantasy")
    await view.user.click(buttons.draft())
    return view
  }

  it("puts a field error next to its field", async () => {
    await submitDraft(400, "validation_failed", { fields: { genre: "required" } })
    expect(await screen.findByText("Choose a genre.")).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })

  it("asks to upload the cover again for an invalid upload", async () => {
    await submitDraft(400, "validation_failed", { fields: { coverUploadId: "invalid" } })
    expect(await screen.findByText("Upload the image again.")).toBeInTheDocument()
  })

  it("explains a series that an admin hid", async () => {
    await submitDraft(403, "hidden_by_admin")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("PhumReader hid this series. Contact support to publish it again."))
  })

  it("tells the wait for a rate limit, and shows the generic error otherwise", async () => {
    const { user } = await submitDraft(429, "too_many_requests", { retryAfterSeconds: 20 })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 20 seconds." })))
    server.use(http.post(`${API}/creator/series`, () => apiError(500, "internal_error")))
    await user.click(buttons.draft())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
  })
})

describe("SeriesForm: editing", () => {
  it("fills the form from the saved series, locks the type and shows the story status", () => {
    renderUi(<SeriesForm initial={saved({ type: "novel", title: "Night Tide", tags: ["sea", "mystery"], status: "hiatus" })} />)
    expect(screen.getByLabelText("Title")).toHaveValue("Night Tide")
    expect(screen.getByLabelText("Genre")).toHaveValue("fantasy")
    expect(screen.getByRole("radio", { name: "Web novel" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Web novel" })).toBeDisabled()
    expect(screen.getByText("A series cannot change between comic and web novel.")).toBeInTheDocument()
    expect(screen.getByLabelText("Story status")).toHaveValue("hiatus")
    expect(screen.getByRole("list", { name: "Tags" }).querySelectorAll("li")).toHaveLength(2)
    expect(screen.getByText("Draft")).toBeInTheDocument()
  })

  it("saves a draft with PUT, keeps the saved cover, stays on the page and leaves the type out", async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.put(`${API}/creator/series/${saved().id}`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json(saved({ title: "Renamed" }))
      }),
    )
    const { user } = renderUi(<SeriesForm initial={saved()} />)
    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Renamed")
    await user.click(buttons.draft())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Changes saved."))
    expect(body.title).toBe("Renamed")
    expect(body.type).toBeUndefined()
    expect(body.coverUploadId).toBeNull()
    expect(router.push).not.toHaveBeenCalled()
  })

  it("publishes: saves, then publishes, and the page switches to Unpublish and Save changes", async () => {
    const calls: string[] = []
    server.use(
      http.put(`${API}/creator/series/${saved().id}`, () => {
        calls.push("save")
        return HttpResponse.json(saved())
      }),
      http.post(`${API}/creator/series/${saved().id}/publish`, () => {
        calls.push("publish")
        return HttpResponse.json(saved({ visibility: "published" }))
      }),
    )
    const { user } = renderUi(<SeriesForm initial={saved()} />)
    await user.click(screen.getByRole("checkbox", { name: /I own this work/ }))
    await user.click(buttons.publish())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Your series is live."))
    expect(calls).toEqual(["save", "publish"])
    expect(await screen.findByRole("button", { name: "Unpublish" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View public page" })).toHaveAttribute("href", "/series/my-series")
  })

  it("a live series: Save changes does not publish again, and Unpublish takes it back to a draft", async () => {
    const calls: string[] = []
    server.use(
      http.put(`${API}/creator/series/${saved().id}`, () => {
        calls.push("save")
        return HttpResponse.json(saved({ visibility: "published" }))
      }),
      http.post(`${API}/creator/series/${saved().id}/unpublish`, () => {
        calls.push("unpublish")
        return HttpResponse.json(saved())
      }),
    )
    const { user } = renderUi(<SeriesForm initial={saved({ visibility: "published" })} />)
    expect(screen.getByText("Published")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Changes saved."))
    await user.click(screen.getByRole("button", { name: "Unpublish" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Your series is a draft again."))
    expect(calls).toEqual(["save", "unpublish"])
    expect(await screen.findByRole("button", { name: "Publish" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "View public page" })).not.toBeInTheDocument()
  })

  it("a hidden series shows the notice and cannot be published", () => {
    renderUi(<SeriesForm initial={saved({ visibility: "hidden" })} />)
    expect(screen.getByRole("alert")).toHaveTextContent("This series is hidden")
    expect(buttons.publish()).toBeDisabled()
  })

  it("shows the generic error when unpublishing fails", async () => {
    server.use(http.post(`${API}/creator/series/${saved().id}/unpublish`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SeriesForm initial={saved({ visibility: "published" })} />)
    await user.click(screen.getByRole("button", { name: "Unpublish" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
    expect(screen.getByText("Published")).toBeInTheDocument()
  })
})
