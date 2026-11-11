import { api, type Schemas } from "@/lib/api/client"

/** Help center: the Contact us form and "Was this helpful?" votes (V21-07). */

export type TicketRequest = {
  topic: string
  email: string
  /** Payments only: TW-12345678 */
  order?: string
  message: string
  locale: string
}

/** Resolves with the ticket number, "T-58214". Works signed in or not. */
export async function createTicket(body: TicketRequest): Promise<string> {
  const order = body.order?.trim()
  return (await api.post<Schemas["TicketResponse"]>("/help/tickets", { ...body, order: order || null })).ticket
}

/** The account's answers by article number: true = helpful. */
export async function fetchVotes(): Promise<Record<number, boolean>> {
  const list = await api.get<Schemas["VoteView"][]>("/me/help-votes")
  return Object.fromEntries(list.map((v) => [v.article, v.helpful]))
}

export const putVote = (article: number, helpful: boolean) => api.put<void>(`/me/help-votes/${article}`, { helpful })
