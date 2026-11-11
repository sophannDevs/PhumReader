# notification

Email and web push for new episodes (P3-16) and the in-app notifications inbox (V21-03). Development prints
emails in the console.

## Layout

| Package | Holds | May use |
|---|---|---|
| `web` | Controllers, request and response records | `service`, this feature's `domain`; other features' `web` response records |
| `service` | Business rules, transactions | `repository`, `domain`, other features' `service` and `domain` |
| `repository` | Database access | `domain` |
| `domain` | Entities, enums, value types | nothing above it |

## Main entry points

`NotificationDispatcher`, `EmailSender` and `PushSender` with their console / SMTP / Resend / FCM variants.
`NotificationInbox`: the inbox endpoints' service and the methods the sources call inside their own transaction
(comment likes, coin orders, report outcomes, review decisions, welcome); `InboxCleanup`: the nightly clean-up.

## Talks to

Called by `series`, `auth`, `user`, `comment`, `payment` and `admin`; uses only `series.domain` (the series
type and review decision enums).

## Rules (checked by `ArchitectureTest`)

- A controller never uses a repository, and never returns or accepts an entity.
- A service never uses `web` or the servlet API.
- `repository` and `domain` never call `service` or `web`.
- Another feature may call this feature's `service` and `domain`, never its `repository`.
