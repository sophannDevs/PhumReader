# notification

Email and web push for new episodes (P3-16). Development prints emails in the console.

## Layout

| Package | Holds | May use |
|---|---|---|
| `web` | Controllers, request and response records | `service`, this feature's `domain`; other features' `web` response records |
| `service` | Business rules, transactions | `repository`, `domain`, other features' `service` and `domain` |
| `repository` | Database access | `domain` |
| `domain` | Entities, enums, value types | nothing above it |

## Main entry points

`NotificationDispatcher`, `EmailSender` and `PushSender` with their console / SMTP / Resend / FCM variants.

## Talks to

Called by `series` and `auth`; calls no other feature.

## Rules (checked by `ArchitectureTest`)

- A controller never uses a repository, and never returns or accepts an entity.
- A service never uses `web` or the servlet API.
- `repository` and `domain` never call `service` or `web`.
- Another feature may call this feature's `service` and `domain`, never its `repository`.
