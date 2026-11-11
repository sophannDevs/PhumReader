import { api, type Schemas } from "@/lib/api/client"

/**
 * The in-app inbox from the real API (V21-03): the Notifications page and the header bell. An item is a `type` plus
 * values in `data`, never text: src/lib/notifications.ts writes it in English or Khmer.
 */

export type NotificationItem = Schemas["NotificationItem"]
export type NotificationType = NotificationItem["type"]
export type NotificationPage = Schemas["CursorPageNotificationItem"]

/** The API's tabs: `episodes`, `comments` and `coins` are one kind each; `system` items show under all and unread only. */
export type InboxTab = "all" | "unread" | "episodes" | "comments" | "coins"

/** Items per page (the API allows 1–100, default 20). */
export const INBOX_PAGE = 20

/** One page of the inbox, newest first; removed items are left out. */
export const fetchNotifications = (tab: InboxTab, cursor?: string) =>
  api.get<NotificationPage>("/me/notifications", { query: { tab, cursor, limit: INBOX_PAGE } })

/** Unread items that were not removed (the bell). */
export async function fetchUnreadCount(): Promise<number> {
  return (await api.get<Schemas["UnreadCount"]>("/me/notifications/unread-count")).count
}

const itemPath = (id: string) => `/me/notifications/${encodeURIComponent(id)}`

/** Marks the item read (PUT) or unread (DELETE). Doing it twice changes nothing. */
export const setNotificationRead = (id: string, read: boolean) =>
  read ? api.put<void>(`${itemPath(id)}/read`) : api.delete<void>(`${itemPath(id)}/read`)

export const markAllNotificationsRead = () => api.post<void>("/me/notifications/read-all")

/** Leaves the list and the count; can be restored for 7 days. */
export const removeNotification = (id: string) => api.delete<void>(itemPath(id))

/** The page's Undo: brings a removed item back. */
export const restoreNotification = (id: string) => api.post<void>(`${itemPath(id)}/restore`)
