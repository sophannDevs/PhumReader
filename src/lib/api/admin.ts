import { api, type Schemas } from "@/lib/api/client";

/** The admin area's calls (P4-16). Only accounts with the ADMIN role may use them; others get 403. */

export type Overview = Schemas["Overview"];
export type AdminUser = Schemas["AdminUser"];
export type AdminContent = Schemas["AdminContent"];
export type AdminReport = Schemas["AdminReport"];
export type AdminOrder = Schemas["AdminOrder"];
export type AuditEntry = Schemas["AuditEntry"];
/** A series waiting for review, with the automatic-check flags (V21-01). */
export type ReviewQueueItem = Schemas["ReviewQueueItem"];
/** A change "Request changes" asks for: contact, cover, title, age or images. */
export type ReviewItemKey = Schemas["ChangesRequest"]["items"][number];
export type ContentType = AdminContent["type"];
export type ReportAction = "dismiss" | "resolve" | "hide";

type Page<T> = { items: T[]; nextCursor?: string | null };
export type ListFilter = { q?: string; status?: string };

const PAGE = 20;

async function page<T>(
  path: string,
  query: Record<string, string | undefined>,
  cursor: string | undefined,
): Promise<Page<T>> {
  return api.get<Page<T>>(path, { query: { ...query, cursor, limit: PAGE } });
}

export const fetchOverview = () => api.get<Overview>("/admin/overview");
export const fetchUsers = (f: ListFilter, cursor?: string) =>
  page<AdminUser>("/admin/users", { q: f.q, status: f.status }, cursor);
export const fetchContent = (
  type: ContentType,
  f: ListFilter,
  cursor?: string,
) =>
  page<AdminContent>(
    "/admin/content",
    { type, q: f.q, status: f.status },
    cursor,
  );
export const fetchReports = (status: string | undefined, cursor?: string) =>
  page<AdminReport>("/admin/reports", { status }, cursor);
export const fetchOrders = (f: ListFilter, cursor?: string) =>
  page<AdminOrder>("/admin/orders", { q: f.q, status: f.status }, cursor);
export const fetchAudit = (action: string | undefined, cursor?: string) =>
  page<AuditEntry>("/admin/audit", { action }, cursor);
/** The series review queue, oldest submission first. */
export const fetchSeriesReview = (cursor?: string) =>
  page<ReviewQueueItem>("/admin/series-review", {}, cursor);

export const banUser = (id: string, reason: string) =>
  api.post<AdminUser>(`/admin/users/${id}/ban`, { reason });
export const unbanUser = (id: string) =>
  api.post<AdminUser>(`/admin/users/${id}/unban`, {});
export const hideContent = (type: ContentType, id: string, reason: string) =>
  api.post<void>(`/admin/content/${type}/${id}/hide`, { reason });
export const restoreContent = (type: ContentType, id: string) =>
  api.post<void>(`/admin/content/${type}/${id}/restore`, {});
export const settleReport = (id: string, action: ReportAction, note: string) =>
  api.post<AdminReport>(`/admin/reports/${id}/settle`, {
    action,
    note: note.trim() || undefined,
  });
export const refundOrder = (id: string, reason: string) =>
  api.post<Schemas["RefundResult"]>(`/admin/orders/${id}/refund`, { reason });

// Series review decisions (V21-01): 409 not_in_review when the series no longer waits (another admin decided).
/** The series goes live. */
export const approveSeries = (id: string) =>
  api.post<void>(`/admin/series/${id}/approve`);
/** Back to the creator with 1–5 changes to make (keys, not labels) and an optional note (up to 300 characters). */
export const requestSeriesChanges = (
  id: string,
  items: ReviewItemKey[],
  note: string,
) =>
  api.post<void>(`/admin/series/${id}/request-changes`, {
    items,
    note: note.trim() || undefined,
  } satisfies Schemas["ChangesRequest"]);
/** Back to a draft, with an optional note. */
export const rejectSeries = (id: string, note = "") =>
  api.post<void>(`/admin/series/${id}/reject`, {
    note: note.trim() || undefined,
  } satisfies Schemas["DecisionNoteRequest"]);
