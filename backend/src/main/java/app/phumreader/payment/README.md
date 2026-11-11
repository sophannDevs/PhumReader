# payment

Coin packs, orders, ABA PayWay (KHQR, ABA Pay, hosted card page), webhooks and purchase history (P3-11).

## Layout

| Package | Holds | May use |
|---|---|---|
| `web` | Controllers, request and response records | `service`, this feature's `domain`; other features' `web` response records |
| `service` | Business rules, transactions | `repository`, `domain`, other features' `service` and `domain` |
| `repository` | Database access | `domain` |
| `domain` | Entities, enums, value types | nothing above it |

## Main entry points

`PaymentService`, `PayWayGateway` (`HttpPayWayGateway` in production), `PayWayCallbacks` (signed webhook), `PaymentReconciler` (nightly job).

## Talks to

`coin` (credits coins).

## Rules (checked by `ArchitectureTest`)

- A controller never uses a repository, and never returns or accepts an entity.
- A service never uses `web` or the servlet API.
- `repository` and `domain` never call `service` or `web`.
- Another feature may call this feature's `service` and `domain`, never its `repository`.
