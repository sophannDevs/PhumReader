# common

Code every feature shares. It must not depend on a feature package.

| Package | Holds |
|---|---|
| `error` | `ApiException`, the error body (`ErrorResponse`) and `GlobalExceptionHandler` |
| `web` | Health check, request id filter, `Viewer` |
| `security` | `CurrentUser`, the signed-in user for a request |
| `paging` | Cursor paging (`CursorPage`, `Cursors`) |
| `idempotency` | Idempotency keys (`IdempotencyKeys`) |
| `ratelimit` | `RateLimiter`: in memory for dev and tests, Redis in production |
| `store` | `ShortLivedStore` for codes and tokens (in memory or Redis) |
| `views` | View counters (in memory or Redis) |
| `jobs` | `JobLock` so a scheduled job runs on one instance |

Pairs such as `RateLimiter` / `RedisRateLimiter` keep the feature code free of Redis: features use the
interface only.
