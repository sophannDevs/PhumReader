# PhumiReader API reference

The REST API of the Spring Boot backend in `backend/` (Phase 2): version **v1**, **103 endpoints**.

> **Where this comes from.** Written from the controllers in `backend/src/main/java/app/phumreader/*/web/`
> and the generated contract `backend/openapi/openapi.json` (2026-11-11, commit `da199ea`). The OpenAPI file is
> the machine-readable contract: `./gradlew check` fails when it is out of date, and `npm run api:gen` turns it
> into the website's TypeScript types (`src/lib/api/schema.d.ts`). This page explains it for people. If the two
> ever disagree, the code wins; please update this page in the same commit as the controller change.
>
> While the API runs (`cd backend && ./gradlew bootRun`) you can also browse it live:
> Swagger UI at http://localhost:8080/swagger-ui.html, raw OpenAPI at http://localhost:8080/v3/api-docs.

## Contents

1. [Basics](#1-basics)
2. [Signing in (cookies)](#2-signing-in-cookies)
3. [CSRF](#3-csrf)
4. [Errors](#4-errors)
5. [Lists and pagination](#5-lists-and-pagination)
6. [Idempotency keys](#6-idempotency-keys)
7. [Rate limits](#7-rate-limits)
8. [Endpoint index](#8-endpoint-index)
9. [Endpoints](#9-endpoints): [Health](#health) · [Auth](#auth) · [Account security](#account-security) ·
   [Me and settings](#me-and-settings) · [Catalog](#catalog) · [Search](#search) · [Reading](#reading) ·
   [Library](#library) · [Comments and reports](#comments-and-reports) · [Coins and payments](#coins-and-payments) ·
   [Creator](#creator) · [Media uploads](#media-uploads) · [Admin](#admin)
10. [Data types](#10-data-types)

---

## 1. Basics

| Topic | Rule |
|---|---|
| Base path | `/api/v1`. In development the website rewrites `/api/:path*` to `BACKEND_URL` (default `http://localhost:8080`), so the browser calls `http://localhost:3000/api/v1/…` on the same origin. |
| Format | JSON in and out (`Content-Type: application/json`). The only exceptions are the two social-login redirects and the PayWay callback. |
| Times | Instants are ISO 8601 in UTC, e.g. `2026-11-11T03:00:00Z`. Calendar dates (`date`) are `YYYY-MM-DD` in Asia/Phnom_Penh. |
| Ids | UUIDs. Public routes address a series by its `slug` (never changes); creator routes use its `id`. Episodes are addressed by their number (`n` / `number`, starting at 1). |
| Numbers | Counts are raw numbers (`12345`, not `"12.3K"`); the website formats them in English or Khmer. Prices: `priceUsdCents` (integer cents) and `priceKhr` (integer riel). |
| Request id | Every response has an `X-Request-Id` header (also in the server logs). Send your own `X-Request-Id` to follow a request through the logs. |
| Status codes | `200` OK with a body · `201` created · `202` accepted (work continues, e.g. an email is sent) · `204` done, no body. Errors: see [Errors](#4-errors). |

## 2. Signing in (cookies)

The API never hands tokens to JavaScript. Signing in sets cookies, and the browser sends them on every request
(with `fetch`, use `credentials: "include"`, or same-origin).

| Cookie | Holds | Path | Lifetime | JS can read |
|---|---|---|---|---|
| `phumreader_at` | Access token (RS256 JWT, carries the roles) | `/` | 15 minutes | No (HttpOnly) |
| `phumreader_rt` | Refresh token (rotates on every refresh, one per device, stored hashed) | `/api/v1/auth` | 30 days | No (HttpOnly) |
| `XSRF-TOKEN` | CSRF token, see [CSRF](#3-csrf) | `/` | Browser session | Yes |
| `phumreader_oauth` | Social-login state between start and callback | `/api/v1/auth/oauth` | 10 minutes | No |

All cookies are `SameSite=Lax`, and `Secure` when `phumreader.auth.secure-cookies` is on (production). With
`"remember": false` at login the two sign-in cookies have no `Max-Age`, so they end when the browser closes.

**Typical flow**

1. `GET /api/v1/auth/csrf` once: sets the `XSRF-TOKEN` cookie.
2. `POST /api/v1/auth/login` (or `signup` → `verify`): sets `phumreader_at` and `phumreader_rt`, returns the account.
3. Call the API. When an answer is `401`, call `POST /api/v1/auth/refresh` once and retry the request
   (the website's fetch wrapper in `src/lib/api/` does this).
4. When `refresh` itself answers `401 session_expired`, the person has to log in again. A refresh token that is
   used twice signs that device out (stolen-token protection).

**Roles and access levels** used in this document:

| Access | Meaning | When it fails |
|---|---|---|
| **Public** | Anyone. Some public reads return more when signed in (e.g. `viewer` state, `liked` flags). | – |
| **Signed in** | A valid access cookie (role `READER` or higher). | `401 unauthorized` |
| **Creator** | Role `CREATOR`, which any reader gets by accepting the Creator terms (`POST /api/v1/creator`). | `403 forbidden` (`401` for guests) |
| **Admin** | Role `ADMIN`. Everything under `/api/v1/admin/**`. | `403 forbidden` (`401` for guests) |

A role change (becoming a creator) is only in the access token after the next `POST /api/v1/auth/refresh`.

## 3. CSRF

Every `POST`, `PUT`, `PATCH` and `DELETE`, **including the public ones such as login and signup**, must send the
header `X-XSRF-TOKEN` with the value of the `XSRF-TOKEN` cookie. Without it the answer is
`403 invalid_csrf_token`. The token stays the same for the whole browser session. The only exception is the
server-to-server PayWay callback.

Trying it with curl (dev profile, seeded demo account):

```bash
curl -s -c jar.txt -b jar.txt http://localhost:8080/api/v1/auth/csrf
```

```bash
XSRF=$(awk '$6=="XSRF-TOKEN"{print $7}' jar.txt)
curl -s -c jar.txt -b jar.txt -H "X-XSRF-TOKEN: $XSRF" -H "Content-Type: application/json" \
  -d '{"email":"reader@phumireader.app","password":"PhumiReader1!"}' \
  http://localhost:8080/api/v1/auth/login
```

```bash
curl -s -b jar.txt http://localhost:8080/api/v1/me/coins
```

## 4. Errors

Every error, including `401` and `403` from the security layer, has the same body:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some fields are not valid.",
    "fields": { "email": "must match \"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$\"" }
  }
}
```

- `code` is stable snake_case; branch on it. `message` is English text for logs and developers; the website shows
  its own translated text per code.
- `fields` (optional) maps a request field to what is wrong with it. Nested fields use dots, e.g. `publish.at`,
  `reader.size`.
- `402` answers add `price` (coins) and `freeOn` (date the episode becomes free).
- `429` answers add `retryAfterSeconds` and the `Retry-After` header.

**General codes** (any endpoint). Endpoint-specific codes are listed with each endpoint.

| Status | Code | When |
|---|---|---|
| 400 | `validation_failed` | A body or parameter breaks a rule (length, pattern, range); see `fields`. |
| 400 | `malformed_request` | The body is not valid JSON or has the wrong shape. |
| 400 | `missing_parameter` | A required query parameter is missing. |
| 400 | `invalid_parameter` | A parameter has the wrong format (e.g. a path id that is not a UUID). |
| 400 | `invalid_cursor` | A `cursor` that this list did not produce. |
| 401 | `unauthorized` | Not signed in, or the access token expired (refresh and retry). |
| 403 | `forbidden` | Signed in, but the role or ownership is wrong. |
| 403 | `invalid_csrf_token` | Missing or wrong `X-XSRF-TOKEN` header. |
| 404 | `not_found` | No such route. Missing things have their own codes (`series_not_found`, `episode_not_found`, …). |
| 405, 415, … | `method_not_allowed`, `unsupported_media_type`, … | Other HTTP errors: the reason phrase in snake_case. |
| 429 | `too_many_requests`, `too_many_attempts`, … | Rate limited, see [Rate limits](#7-rate-limits). |
| 500 | `internal_error` | A bug on our side; quote the `X-Request-Id` when reporting it. |

## 5. Lists and pagination

Paged lists take `?cursor=&limit=` and answer:

```json
{ "items": [ … ], "nextCursor": "eyJ0IjoiMjAyNi0xMS0xMFQwOToxNTowMFoiLCJpZCI6IjEyMyJ9" }
```

- `limit`: 1–100, default 20.
- Leave `cursor` out for the first page; pass the previous `nextCursor` for the next one. `nextCursor: null`
  means there are no more pages. Cursors are opaque: don't build or change them.
- The sort options are per endpoint (`sort=recent|title`, `sort=top|newest`, …).

Not paged: `GET /genres`, `GET /search` (its own `limit`, 1–20, default 8), `GET /search/suggestions` (up to 6),
`GET /creator/series`, `GET /creator/series/{id}/episodes` and `GET /auth/devices`.

## 6. Idempotency keys

Requests that move money or access need an `Idempotency-Key` header:

- `POST /api/v1/coins/orders`
- `POST /api/v1/series/{slug}/episodes/{n}/unlock`

Use a new random value per action (e.g. `crypto.randomUUID()`), 8–100 visible ASCII characters, and **send the same
key again when retrying** the same action after a timeout or network error. The retry then returns the first answer
instead of charging twice. Keys are kept for 24 hours per user.

| Status | Code | When |
|---|---|---|
| 400 | `missing_idempotency_key` | No header. |
| 400 | `invalid_idempotency_key` | Shorter than 8, longer than 100, or not visible ASCII. |
| 409 | `idempotency_key_reused` | The key was already used for a different request. |

## 7. Rate limits

Limits are counted in Redis when `phumreader.redis.url` is set (shared by every API instance; if Redis is
unreachable, requests are let through), otherwise in the API's memory. Over the limit the answer is `429` with
`Retry-After`.

| Action | Limit | Code |
|---|---|---|
| Sign up | 10 per IP per hour | `too_many_requests` |
| Log in | 30 per IP per 10 min; 5 wrong passwords per account per 10 min | `too_many_attempts` |
| Resend a sign-up code / an email-change code | 1 per 30 s per address | `resend_too_soon` |
| Forgot password | 10 per IP per hour; after 3 per email per hour no more emails are sent (the answer stays `202`) | `too_many_requests` |
| Reset password | 10 per IP per 10 min | `too_many_requests` |
| Wrong current password (change password, change email, delete account) | 5 per account per 10 min | `too_many_attempts` |
| Social login (start and callback) | 30 per IP per 10 min | `too_many_requests` |
| Post a comment | 10 per user per 10 min | `too_many_comments` |
| Report content | 20 per user per hour | `too_many_reports` |
| Create a coin order | 20 per user per hour | `too_many_orders` |

---

## 8. Endpoint index

Paths below are relative to `/api/v1`. "CSRF" applies to every write (see [CSRF](#3-csrf)).

| Method | Path | Access | What it does |
|---|---|---|---|
| **Health** ||||
| GET | `/health` | Public | Is the API up and can it reach the database |
| **Auth** ||||
| GET | `/auth/csrf` | Public | Set the `XSRF-TOKEN` cookie |
| POST | `/auth/signup` | Public | Create an account, email a 6-digit code |
| POST | `/auth/verify` | Public | Confirm the email with the code and sign in |
| POST | `/auth/resend-code` | Public | Email a new sign-up code |
| POST | `/auth/login` | Public | Sign in with email and password |
| POST | `/auth/refresh` | Public (refresh cookie) | New sign-in cookies |
| POST | `/auth/logout` | Public | Sign this device out |
| POST | `/auth/logout-all` | Signed in | Sign out on every device |
| POST | `/auth/forgot-password` | Public | Email a password reset link |
| POST | `/auth/reset-password` | Public | Set a new password from the link |
| GET | `/auth/oauth/{provider}/start` | Public (browser) | Go to Google or Facebook |
| GET | `/auth/oauth/{provider}/callback` | Public (browser) | Come back from Google or Facebook |
| **Account security** ||||
| POST | `/auth/change-password` | Signed in | New password, other devices signed out |
| POST | `/auth/change-email` | Signed in | Email a code to the new address |
| POST | `/auth/change-email/confirm` | Signed in | Confirm the new address |
| GET | `/auth/devices` | Signed in | Signed-in devices |
| DELETE | `/auth/devices/{id}` | Signed in | Sign one device out |
| POST | `/auth/delete-account` | Signed in | Delete the account after 30 days |
| **Me and settings** ||||
| GET | `/me` | Signed in | The signed-in account |
| PATCH | `/me/profile` | Signed in | Change the display name |
| PUT | `/me/avatar` | Signed in | Set the profile picture |
| DELETE | `/me/avatar` | Signed in | Remove the profile picture |
| GET | `/me/settings` | Signed in | Settings |
| PATCH | `/me/settings` | Signed in | Change some settings |
| PUT | `/me/push-token` | Signed in | Save this browser's push token |
| DELETE | `/me/push-token` | Signed in | Forget this browser's push token |
| **Catalog** ||||
| GET | `/home` | Public | Home feed |
| GET | `/rankings` | Public | Ranking of comics or novels |
| GET | `/genres` | Public | All genres |
| GET | `/genres/{slug}` | Public | One genre |
| GET | `/series` | Public | Published series, filtered |
| GET | `/series/{slug}` | Public | Series page |
| GET | `/series/{slug}/episodes` | Public | Released episodes of a series |
| **Search** ||||
| GET | `/search` | Public | Search series with filters |
| GET | `/search/suggestions` | Public | Search-as-you-type titles |
| **Reading** ||||
| GET | `/series/{slug}/episodes/{n}` | Public | Read an episode or chapter (402 when locked) |
| PUT | `/series/{slug}/progress` | Signed in | Save the reading position |
| PUT | `/series/{slug}/episodes/{n}/like` | Signed in | Like an episode |
| DELETE | `/series/{slug}/episodes/{n}/like` | Signed in | Take back the like |
| PUT | `/series/{slug}/episodes/{n}/bookmark` | Signed in | Bookmark an episode |
| DELETE | `/series/{slug}/episodes/{n}/bookmark` | Signed in | Remove the bookmark |
| **Library** ||||
| PUT | `/series/{slug}/subscription` | Signed in | Subscribe |
| DELETE | `/series/{slug}/subscription` | Signed in | Unsubscribe |
| GET | `/series/{slug}/me` | Signed in | My state on a series page |
| PUT | `/creators/{id}/follow` | Signed in | Follow a creator |
| DELETE | `/creators/{id}/follow` | Signed in | Unfollow a creator |
| GET | `/me/history` | Signed in | Reading history |
| GET | `/me/subscriptions` | Signed in | Subscribed series |
| GET | `/me/unlocked` | Signed in | Unlocked episodes |
| GET | `/me/follows` | Signed in | Followed creators |
| POST | `/me/subscriptions/remove` | Signed in | Unsubscribe from several series (undoable) |
| POST | `/me/subscriptions/restore` | Signed in | Undo that |
| POST | `/me/history/remove` | Signed in | Remove series from history (undoable) |
| POST | `/me/history/restore` | Signed in | Undo that |
| **Comments and reports** ||||
| GET | `/series/{slug}/comments` | Public | Series comments |
| POST | `/series/{slug}/comments` | Signed in | Comment on a series |
| GET | `/series/{slug}/episodes/{n}/comments` | Public | Episode comments |
| POST | `/series/{slug}/episodes/{n}/comments` | Signed in | Comment on an episode |
| DELETE | `/comments/{id}` | Signed in | Delete a comment |
| PUT | `/comments/{id}/like` | Signed in | Like a comment |
| DELETE | `/comments/{id}/like` | Signed in | Take back the like |
| POST | `/series/{slug}/report` | Signed in | Report a series |
| POST | `/series/{slug}/episodes/{n}/report` | Signed in | Report an episode |
| POST | `/comments/{id}/report` | Signed in | Report a comment |
| **Coins and payments** ||||
| GET | `/coins/packs` | Public | Coin packs and payment methods |
| GET | `/me/coins` | Signed in | Balance |
| GET | `/me/coins/ledger` | Signed in | Every coin change |
| POST | `/coins/orders` | Signed in | Start buying a pack (Idempotency-Key) |
| GET | `/coins/orders/{number}` | Signed in | One order (poll while paying) |
| POST | `/coins/orders/{number}/cancel` | Signed in | Cancel an open order |
| POST | `/coins/orders/{number}/simulate` | Signed in, dev only | Pay or fail an order without PayWay |
| GET | `/me/coins/orders` | Signed in | Purchase history |
| POST | `/series/{slug}/episodes/{n}/unlock` | Signed in | Unlock a Fast Pass episode (Idempotency-Key) |
| POST | `/payments/payway/callback` | PayWay signature | ABA PayWay server callback (not in OpenAPI) |
| **Creator** ||||
| POST | `/creator` | Signed in | Accept the Creator terms |
| GET | `/creator/dashboard` | Signed in | Creator dashboard |
| GET | `/creator/series` | Creator | My series |
| POST | `/creator/series` | Creator | Create a series (draft) |
| GET | `/creator/series/{id}` | Creator | One series for the edit form |
| PUT | `/creator/series/{id}` | Creator | Edit a series |
| POST | `/creator/series/{id}/publish` | Creator | Put the series live |
| POST | `/creator/series/{id}/unpublish` | Creator | Back to draft |
| GET | `/creator/series/{id}/episodes` | Creator | All episodes, drafts too |
| POST | `/creator/series/{id}/episodes` | Creator | Add an episode or chapter |
| GET | `/creator/series/{id}/episodes/{number}` | Creator | One episode for the edit form |
| PUT | `/creator/series/{id}/episodes/{number}` | Creator | Edit an episode |
| DELETE | `/creator/series/{id}/episodes/{number}` | Creator | Delete a draft or scheduled episode |
| **Media uploads** ||||
| POST | `/creator/uploads` | Creator (any signed-in user for `AVATAR`) | Start an image upload |
| POST | `/creator/uploads/{id}/complete` | Signed in (owner) | Check the image, make variants |
| GET | `/creator/uploads/{id}` | Signed in (owner) | Upload state |
| **Admin** ||||
| GET | `/admin/overview` | Admin | Counts for the start page |
| GET | `/admin/users` | Admin | Users |
| POST | `/admin/users/{id}/ban` | Admin | Suspend an account |
| POST | `/admin/users/{id}/unban` | Admin | Lift a suspension |
| GET | `/admin/content` | Admin | Series, episodes or comments |
| POST | `/admin/content/{type}/{id}/hide` | Admin | Take content down |
| POST | `/admin/content/{type}/{id}/restore` | Admin | Put it back |
| GET | `/admin/reports` | Admin | Report queue |
| POST | `/admin/reports/{id}/settle` | Admin | Dismiss, resolve or hide |
| GET | `/admin/orders` | Admin | Coin orders |
| POST | `/admin/orders/{id}/refund` | Admin | Refund a paid order |
| GET | `/admin/audit` | Admin | Audit log |

---

## 9. Endpoints

Each endpoint lists its access level, parameters, body, success answer and its own error codes. The general codes
in [Errors](#4-errors) (`validation_failed`, `401`, CSRF, …) apply everywhere and are not repeated.

### Health

#### `GET /api/v1/health`

Is the API running and can it reach the database? **Public.**

**200** → [HealthResponse](#healthresponse) `{ "status": "UP", "database": "UP" }`.
**503** → the same body with `"DOWN"` when the database cannot be reached.

(Spring's own `GET /actuator/health` is public too, for uptime checks.)

### Auth

#### `GET /api/v1/auth/csrf`

Sets the `XSRF-TOKEN` cookie that every write must echo in `X-XSRF-TOKEN`. **Public.** Call it once when the app
starts. **200**, no useful body.

#### `POST /api/v1/auth/signup`

Creates an account and emails a 6-digit code (valid 10 minutes, 5 tries). **Public.**

```json
{ "name": "Sokha Chan", "email": "sokha@example.com", "password": "Sokha2026!", "language": "km" }
```

| Field | Rules |
|---|---|
| `name` | 2–60 characters |
| `email` | up to 254 characters, an email address |
| `password` | up to 128 characters and at least 3 of: 8+ characters, upper and lower case, a number, a symbol |
| `language` | optional, `en` or `km`: the account's starting language setting |

**201** → [SignupResponse](#signupresponse) `{ "email", "codeExpiresInSeconds", "resendAfterSeconds" }`.
**Errors:** `400 password_too_weak` (field `password`) · `409 email_taken` (a confirmed account has this email) ·
`429 too_many_requests`.

#### `POST /api/v1/auth/verify`

Confirms the email with its code and signs in. **Public.**

```json
{ "email": "sokha@example.com", "code": "123456" }
```

**200** → [MeResponse](#meresponse), sign-in cookies set.
**Errors:** `400 invalid_code`, `400 code_expired`, `400 too_many_attempts` (all on field `code`).

#### `POST /api/v1/auth/resend-code`

Emails a new sign-up code. **Public.** Body: `{ "email": "sokha@example.com" }`.
**202**, the same answer whether or not such an unverified account exists.
**Errors:** `429 resend_too_soon` (within 30 s of the last code).

#### `POST /api/v1/auth/login`

Signs in with email and password. **Public.**

```json
{ "email": "reader@phumireader.app", "password": "PhumiReader1!", "remember": true }
```

`remember` is optional and defaults to `true` (cookies survive closing the browser); `false` gives session cookies.
Logging in to an account that is waiting for deletion cancels the deletion.

**200** → [MeResponse](#meresponse), sign-in cookies set.
**Errors:** `401 invalid_credentials` · `403 email_not_verified` (a new code is emailed; continue with `/verify`) ·
`403 account_banned` · `429 too_many_attempts`.

#### `POST /api/v1/auth/refresh`

New sign-in cookies from the refresh cookie (the refresh token rotates). **Public**, no body.
**200** → [MeResponse](#meresponse).
**Errors:** `401 session_expired` (refresh cookie missing, expired or already used).

#### `POST /api/v1/auth/logout`

Signs this device out and clears both cookies. **Public** (works with an expired access token). **204.**

#### `POST /api/v1/auth/logout-all`

Signs the account out on every device. **Signed in.** **204.** Access tokens already issued keep working for up
to 15 minutes.

#### `POST /api/v1/auth/forgot-password`

Emails a reset link (valid 30 minutes) when the account exists. **Public.** Body: `{ "email": "…" }`.
**202**, the same answer either way. **Errors:** `429 too_many_requests`.

#### `POST /api/v1/auth/reset-password`

Sets a new password from a reset link and signs out every device. **Public.**

```json
{ "token": "<token from the email link>", "password": "NewPass2026!" }
```

**204.** **Errors:** `400 invalid_token` · `400 password_too_weak` (field `password`) · `429 too_many_requests`.

#### `GET /api/v1/auth/oauth/{provider}/start`

Browser navigation (a link, not `fetch`) that sends the person to Google or Facebook. **Public.**

| Parameter | In | Notes |
|---|---|---|
| `provider` | path | `google` or `facebook` |
| `locale` | query | `en` or `km`: which login page to come back to |

**302** to the provider. Without app credentials for that provider: **302** to `/login?social=unavailable`.

#### `GET /api/v1/auth/oauth/{provider}/callback`

Where the provider sends the browser back to (`code`, `state` or `error` query parameters). **Public.** Accounts
are linked by verified email. Sets the sign-in cookies on success and always redirects to the website's login page,
`/login?social=<result>` (or `/km/login?…`):

| `social=` | Meaning |
|---|---|
| `done` | Signed in |
| `cancelled` | The person pressed Cancel at the provider |
| `social_failed` | Stale or foreign link, or the provider failed |
| `social_no_email`, `social_email_unverified`, `account_banned`, … | Any other error code from the sign-in |

### Account security

These live under `/auth` because they need to know which device is asking (the refresh cookie is only sent there).

#### `POST /api/v1/auth/change-password`

Sets a new password and signs out the other devices (this one stays signed in). **Signed in.**

```json
{ "currentPassword": "PhumiReader1!", "newPassword": "Better2026!" }
```

**204.** **Errors:** `400 wrong_password` (field `currentPassword`) · `400 password_too_weak` (field `newPassword`) ·
`429 too_many_attempts`.

#### `POST /api/v1/auth/change-email`

Emails a 6-digit code to the new address. **Signed in.**

```json
{ "newEmail": "sokha.new@example.com", "password": "PhumiReader1!" }
```

**202** → [EmailChangeResponse](#emailchangeresponse).
**Errors:** `400 wrong_password` (field `password`) · `400 same_email` · `409 email_taken` · `429 resend_too_soon` ·
`429 too_many_attempts`.

#### `POST /api/v1/auth/change-email/confirm`

Confirms the new email with its code. **Signed in.** Body: `{ "code": "123456" }`.
**200** → [MeResponse](#meresponse) with the new email.
**Errors:** `400 invalid_code`, `400 code_expired`, `400 too_many_attempts` (field `code`) · `409 email_taken`.

#### `GET /api/v1/auth/devices`

Signed-in devices, this one first. **Signed in.** **200** → [DeviceList](#devicelist).

#### `DELETE /api/v1/auth/devices/{id}`

Signs out one device. Signing out the current device also clears its cookies. **Signed in.** **204.**
**Errors:** `404 device_not_found`.

#### `POST /api/v1/auth/delete-account`

Schedules the account for deletion in 30 days and signs out every device. Logging in before `deleteAfter` keeps
the account. **Signed in.** Body: `{ "password": "…" }`.
**200** → [DeletionResponse](#deletionresponse) `{ "deleteAfter": "2026-12-11T03:00:00Z" }`.
**Errors:** `400 wrong_password` (field `password`) · `429 too_many_attempts`.

### Me and settings

#### `GET /api/v1/me`

The signed-in account. **Signed in.** **200** → [MeResponse](#meresponse). The website uses the `401` to know the
visitor is a guest.

#### `PATCH /api/v1/me/profile`

Changes the display name. **Signed in.** Body: `{ "displayName": "Sokha" }` (2–60 characters after trimming).
**200** → [MeResponse](#meresponse). **Errors:** `400 name_too_short`.

#### `PUT /api/v1/me/avatar`

Sets the profile picture from a finished `AVATAR` upload (see [Media uploads](#media-uploads): create with
`kind: "AVATAR"`, PUT the file, then `/complete`). **Signed in.** Body: `{ "uploadId": "<uuid>" }`.
**200** → [MeResponse](#meresponse).
**Errors:** `400 upload_invalid` · `400 upload_not_ready` (field `uploadId`).

#### `DELETE /api/v1/me/avatar`

Removes the profile picture (the website shows initials again). **Signed in.** **200** → [MeResponse](#meresponse).

#### `GET /api/v1/me/settings`

**Signed in.** **200** → [Settings](#settings).

#### `PATCH /api/v1/me/settings`

Saves only the fields that are sent and returns all settings. **Signed in.**

```json
{ "theme": "dark", "reader": { "size": 20 }, "notifications": { "episodes": false } }
```

| Field | Values |
|---|---|
| `language` | `en`, `km` |
| `theme` | `system`, `light`, `dark` |
| `reader.font` | `sans`, `serif` |
| `reader.size` | `14`, `16`, `18`, `20`, `22`, `24` |
| `reader.theme` | `light`, `sepia`, `dark` |
| `reader.wide` | boolean |
| `notifications.episodes` | boolean: new-episode notices for subscribed series |
| `notifications.fastPass` | boolean |

**200** → [Settings](#settings). **Errors:** `400 invalid_text_size` (field `reader.size`).

#### `PUT /api/v1/me/push-token`

Saves this browser's web push (Firebase) token. New-episode notices go to every saved token of the account while
`notifications.episodes` is on. **Signed in.** Body: `{ "token": "<FCM token, up to 4096 chars>" }`. **204.**

#### `DELETE /api/v1/me/push-token`

Forgets this browser's push token (the reader turned push off). **Signed in.** Same body as above (a `DELETE` with
a body). **204.**

### Catalog

All public. Answers keep the website's field names (`src/data/types.ts`) with raw values.

#### `GET /api/v1/home`

Home feed: hero slides, daily updates by weekday, rankings, genres, web novels. **200** → [HomeFeed](#homefeed).

#### `GET /api/v1/rankings`

A ranking, best first.

| Parameter | Values |
|---|---|
| `kind` | `comics` (default) or `novels` |
| `cursor`, `limit` | [paging](#5-lists-and-pagination) |

**200** → page of [RankingEntry](#rankingentry) (`previousRank` gives the movement; `null` = new).

#### `GET /api/v1/genres`

All genres in display order. **200** → [GenreItem](#genreitem)`[]`.

#### `GET /api/v1/genres/{slug}`

One genre. **200** → [GenreItem](#genreitem). **Errors:** `404 genre_not_found`.

#### `GET /api/v1/series`

Published series.

| Parameter | Values |
|---|---|
| `type` | `comic` or `novel` (optional) |
| `genre` | genre slug, e.g. `slice-of-life` (optional) |
| `sort` | `popular` (default) or `newest` |
| `cursor`, `limit` | [paging](#5-lists-and-pagination) |

**200** → page of [SeriesCard](#seriescard). **Errors:** `400 unknown_genre` (field `genre`).

#### `GET /api/v1/series/{slug}`

The series page. **200** → [SeriesDetail](#seriesdetail). **Errors:** `404 series_not_found`.

#### `GET /api/v1/series/{slug}/episodes`

Released episodes (no drafts, nothing scheduled in the future).

| Parameter | Values |
|---|---|
| `sort` | `oldest` (default) or `newest` |
| `cursor`, `limit` | [paging](#5-lists-and-pagination) |

**200** → page of [EpisodeSummary](#episodesummary). **Errors:** `404 series_not_found`.

### Search

Backed by Meilisearch (Khmer and English titles). Both public.

#### `GET /api/v1/search`

Series by title, creator or genre.

| Parameter | Values |
|---|---|
| `q` | text, 0–100 characters (default empty) |
| `type` | `comic`, `novel` |
| `genre` | genre slug, up to 60 characters |
| `status` | `ongoing`, `completed`, `hiatus` |
| `sort` | `relevance`, `popular`, `newest` |
| `limit` | 1–20 (default 8) |

An empty `q` with no filter returns the 6 most-viewed series ("Popular now"); an empty `q` with a filter lists the
matching series. **200** → [SearchResults](#searchresults) `{ "items": SeriesCard[] }` (not paged).
**Errors:** `400 invalid_value` (field: the parameter) for an unknown filter or sort.

#### `GET /api/v1/search/suggestions`

Up to 6 series titles for search-as-you-type. `q`: 0–100 characters; empty returns the most-viewed titles.
**200** → [Suggestions](#suggestions) `{ "items": ["…", "…"] }`.

### Reading

#### `GET /api/v1/series/{slug}/episodes/{n}`

An episode (comic: `panels`) or chapter (novel: `blocks`) to read. **Public**; when signed in, `viewer` carries the
reader's like, bookmark and unlock state. The series' creator and admins read Fast Pass episodes without unlocking.
Panel URLs of Fast Pass episodes are signed and work for 5 minutes: load the episode again instead of caching them.

**200** → [EpisodeContent](#episodecontent).
**Errors:** `402 episode_locked` with `price` and `freeOn` (a Fast Pass episode the reader has not unlocked; guests
get it too) · `404 series_not_found` / `episode_not_found`.

#### `PUT /api/v1/series/{slug}/progress`

Saves where the reader is (Continue reading). **Signed in.**

```json
{ "episode": 12, "progress": 0.45 }
```

`episode` ≥ 1, `progress` 0–1 (share of the episode read). **204.**

#### `PUT /api/v1/series/{slug}/episodes/{n}/like` · `DELETE …/like`

Like an episode / take the like back. **Signed in.** Both are safe to repeat.
**200** → [EpisodeLikeState](#episodelikestate) `{ "liked": true, "likes": 1204 }`.

#### `PUT /api/v1/series/{slug}/episodes/{n}/bookmark` · `DELETE …/bookmark`

Bookmark an episode or chapter / remove the bookmark. **Signed in.**
**200** → [BookmarkState](#bookmarkstate) `{ "bookmarked": true }`.

### Library

#### `PUT /api/v1/series/{slug}/subscription` · `DELETE …/subscription`

Subscribe to a series / unsubscribe. **Signed in.**
**200** → [SubscriptionState](#subscriptionstate) `{ "subscribed": true, "subscribers": 5320 }`.

#### `GET /api/v1/series/{slug}/me`

The reader's own state on a series page: subscribed, following the creator, read marks, unlocked episode numbers.
**Signed in.** **200** → [SeriesViewer](#seriesviewer).

#### `PUT /api/v1/creators/{id}/follow` · `DELETE …/follow`

Follow / stop following a creator (`id` = `creatorId` from [SeriesDetail](#seriesdetail)). **Signed in.**
**200** → [FollowState](#followstate) `{ "following": true, "followers": 88 }`. **Errors:** `404 creator_not_found`.

#### `GET /api/v1/me/history`

Continue reading / Recently read. **Signed in.** `sort`: `recent` (default) or `title`; plus paging.
**200** → page of [HistoryEntry](#historyentry).

#### `GET /api/v1/me/subscriptions`

Subscribed series. **Signed in.** `sort`: `recent` (default) or `title`; plus paging.
**200** → page of [SubscriptionEntry](#subscriptionentry).

#### `GET /api/v1/me/unlocked`

Unlocked episodes. **Signed in.** `sort`: `recent` (default) or `title` (series title, then number); plus paging.
**200** → page of [UnlockedEntry](#unlockedentry).

#### `GET /api/v1/me/follows`

Followed creators, most recent first. **Signed in.** Paging only. **200** → page of [FollowedCreator](#followedcreator).

#### `POST /api/v1/me/subscriptions/remove`

Unsubscribes from several series (Library edit mode). **Signed in.**

```json
{ "seriesIds": ["8f0c…", "1b2d…"] }
```

**200** → [RemovedSubscriptions](#removedsubscriptions): keep it to undo.

#### `POST /api/v1/me/subscriptions/restore`

Undo: subscribes again with the original dates. **Signed in.** Body: the `items` from the remove answer,
`{ "items": [ { "seriesId": "…", "subscribedAt": "…" } ] }`. **204.**

#### `POST /api/v1/me/history/remove`

Removes series from the reading history. **Signed in.** Body: `{ "seriesIds": [ … ] }`.
**200** → [RemovedHistory](#removedhistory): keep it to undo.

#### `POST /api/v1/me/history/restore`

Undo a history remove. **Signed in.** Body: `{ "items": [ …the RemovedHistoryEntry items… ] }`. **204.**

### Comments and reports

#### `GET /api/v1/series/{slug}/comments`

Comments on the series page. **Public**; when signed in, `liked`, `mine` and `canDelete` are filled in for the reader.

| Parameter | Values |
|---|---|
| `sort` | `top` (default) or `newest` |
| `cursor`, `limit` | [paging](#5-lists-and-pagination) |

**200** → page of [CommentView](#commentview). `top: true` marks comments with 10 or more likes.

#### `GET /api/v1/series/{slug}/episodes/{n}/comments`

Comments on an episode. Same parameters and answer as above.

#### `POST /api/v1/series/{slug}/comments`

Comment on the series page. **Signed in.** Body: `{ "body": "Loved this chapter!" }` (1–500 characters).
**201** → [CommentView](#commentview).
**Errors:** `400 too_long` (field `body`) · `404 series_not_found` · `429 too_many_comments`.

#### `POST /api/v1/series/{slug}/episodes/{n}/comments`

Comment on an episode. **Signed in.** Same body and answer.
**Errors:** as above, plus `402` when the reader may not read the episode · `403 comments_disabled` (the creator
turned comments off for this episode).

#### `DELETE /api/v1/comments/{id}`

Deletes a comment: its author, the series' creator or an admin. **Signed in.** **204.**
**Errors:** `403 forbidden` · `404 comment_not_found`.

#### `PUT /api/v1/comments/{id}/like` · `DELETE …/like`

Like a comment / take the like back. **Signed in.**
**200** → [CommentLikeState](#commentlikestate) `{ "liked": true, "likes": 12 }`.

#### `POST /api/v1/series/{slug}/report` · `POST /api/v1/series/{slug}/episodes/{n}/report` · `POST /api/v1/comments/{id}/report`

Report a series, an episode or a comment to the admins (it lands in `GET /admin/reports`). **Signed in.**

```json
{ "reason": "spam", "details": "Same link posted on every episode." }
```

`reason`: a short reason key, up to 50 characters. `details`: optional, up to 1000 characters.
**202.** **Errors:** `404` for unknown content · `429 too_many_reports`.

### Coins and payments

Coins come only from the append-only ledger; the balance never goes below zero. An order moves
`pending → paid | failed | cancelled | expired` (expires after `orderExpiryMinutes`, 10 by default), and an admin
can move a paid order to `refunded`. ABA PayWay's callback is the source of truth for "paid"; the website polls the
order every 3 seconds while the reader pays.

#### `GET /api/v1/coins/packs`

Coin packs and the ways to pay. **Public.** **200** → [CoinShop](#coinshop). `simulator: true` means the dev
simulator is on (no real PayWay).

#### `GET /api/v1/me/coins`

The reader's balance and whether the first-purchase bonus is still on offer. **Signed in.** **200** → [Wallet](#wallet).

#### `GET /api/v1/me/coins/ledger`

Every change to the reader's coins (purchase, bonus, unlock, refund, adjustment), newest first. **Signed in.**
Paging only. **200** → page of [LedgerEntry](#ledgerentry).

#### `POST /api/v1/coins/orders`

Starts buying a coin pack. **Signed in.** Header `Idempotency-Key` required ([details](#6-idempotency-keys)): a
retry with the same key returns the same order.

```json
{ "packId": 2, "method": "khqr" }
```

`method`: `khqr`, `aba` (ABA Pay) or `card` (PayWay's hosted card page; PhumiReader never sees card numbers).

**201** → [OrderView](#orderview). Its `checkout` tells the website how to pay: `qrString` / `qrImage` for KHQR,
`abaDeeplink` for ABA Pay, `formAction` + `formFields` (a form to post to PayWay) for cards. On the first paid order
`firstBonusCoins` adds the pack's coins again.
**Errors:** `400 unknown_pack` (field `packId`) · the idempotency errors · `429 too_many_orders` ·
`503 payments_unavailable` (PayWay not configured or not answering) · `503 price_not_set`.

#### `GET /api/v1/coins/orders/{number}`

One of the reader's orders, by its order number. Poll it while the reader pays. **Signed in.**
**200** → [OrderView](#orderview). **Errors:** `404 order_not_found`.

#### `POST /api/v1/coins/orders/{number}/cancel`

Cancels an open order. **Signed in.** **200** → [OrderView](#orderview).
**Errors:** `404 order_not_found` · `409 order_expired` · `409 order_closed` (already paid, failed or cancelled).

#### `POST /api/v1/coins/orders/{number}/simulate`

**Development only:** pays or fails an order without ABA PayWay. **Signed in.** Body: `{ "outcome": "paid" }` or
`{ "outcome": "failed" }`. **200** → [OrderView](#orderview).
**Errors:** `404` when `phumreader.payments.simulator` is off (always in production) · `409 order_expired` /
`order_closed`.

#### `GET /api/v1/me/coins/orders`

The reader's orders, newest first (purchase history). **Signed in.** Paging only.
**200** → page of [OrderView](#orderview).

#### `POST /api/v1/series/{slug}/episodes/{n}/unlock`

Unlocks a Fast Pass episode with coins. **Signed in.** Header `Idempotency-Key` required. No body. Charged at most
once: a retry with the same key, or unlocking the same episode again, costs nothing (`alreadyUnlocked: true`).

**200** → [UnlockResult](#unlockresult) `{ "episode": 13, "coins": 5, "balance": 25, "alreadyUnlocked": false }`.
**Errors:** `402 not_enough_coins` (with `price`, `freeOn`) · `409 episode_not_locked` (free to read, or the reader
owns the series / is an admin) · `404 series_not_found` / `episode_not_found` · the idempotency errors.

#### `POST /api/v1/payments/payway/callback`

ABA PayWay's server-to-server notice that a payment finished. Hidden from OpenAPI; not for the website. No cookie,
no CSRF; the raw body must carry PayWay's signature in `X-PAYWAY-HMAC-SHA512`. The API then asks PayWay for the real
state before any coin is credited, and coins are credited once even if the callback arrives twice. A nightly job
reconciles open orders.
**200** `OK` (plain text) · **401** `Invalid signature`.

### Creator

Readers become creators by accepting the Creator terms. Series are addressed by `id` here, episodes by `number`.

#### `POST /api/v1/creator`

Accepts the Creator terms and adds the `CREATOR` role. **Signed in.**

```json
{ "penName": "Chan Sreyleak", "acceptTerms": true }
```

**201** → [BecomeCreatorResponse](#becomecreatorresponse) `{ "penName": "…" }`. Then call
`POST /api/v1/auth/refresh` so the access token carries the new role.
**Errors:** `409 already_creator`.

#### `GET /api/v1/creator/dashboard`

The signed-in creator's series and totals. **Signed in.** Readers who are not creators get `creator: false` and no
series (the page's empty state). **200** → [CreatorDashboard](#creatordashboard).

#### `GET /api/v1/creator/series`

My series. **Creator.** `q` filters by title; `visibility`: `draft`, `published` or `hidden`.
**200** → [CreatorSeries](#creatorseries)`[]` (not paged).

#### `POST /api/v1/creator/series`

Creates a series as a draft. **Creator.** The slug is made from the title and never changes.

```json
{
  "title": "Rice Field Ghosts",
  "type": "comic",
  "genre": "horror",
  "languages": ["km", "en"],
  "summary": "A village story…",
  "tags": ["village", "ghost"],
  "ageRating": "teen",
  "status": "ongoing",
  "updateDay": "Fri",
  "coverUploadId": "<uuid of a finished COVER upload>",
  "bannerUploadId": "<uuid of a finished BANNER upload>"
}
```

| Field | Rules |
|---|---|
| `title` | required, up to 120 characters |
| `genre` | required, a genre slug |
| `languages` | required, each `en` or `km` |
| `type` | `comic` or `novel`; cannot change later (`400 type_fixed`) |
| `summary` | up to 2000 characters (needed to publish) |
| `tags` | up to 10 |
| `ageRating` | `all`, `teen`, `mature` |
| `status` | `ongoing`, `completed`, `hiatus` |
| `updateDay` | `Mon` … `Sun`, or `null` |
| `coverUploadId`, `bannerUploadId` | finished uploads of kind `COVER` / `BANNER` (a cover is needed to publish) |

**201** → [SeriesEdit](#seriesedit). **Errors:** `400 unknown_genre` · `400 upload_invalid` / `upload_not_ready` ·
`403 not_a_creator`.

#### `GET /api/v1/creator/series/{id}`

One of my series, as the edit form shows it. **Creator.** **200** → [SeriesEdit](#seriesedit).
**Errors:** `403 not_your_series` · `404 series_not_found`.

#### `PUT /api/v1/creator/series/{id}`

Edits a series. **Creator.** Same body as create; leave the upload ids out to keep the current cover and banner.
**200** → [SeriesEdit](#seriesedit). **Errors:** as create and get, plus `400 type_fixed`.

#### `POST /api/v1/creator/series/{id}/publish`

Puts the series live (needs a summary and a cover). **Creator.** **200** → [SeriesEdit](#seriesedit).
**Errors:** `400 required` (field `summary` or `coverUploadId`) · `403 hidden_by_admin`.

#### `POST /api/v1/creator/series/{id}/unpublish`

Takes the series back to a draft. **Creator.** **200** → [SeriesEdit](#seriesedit). **Errors:** `403 hidden_by_admin`.

#### `GET /api/v1/creator/series/{id}/episodes`

Every episode, newest first, drafts and scheduled ones too. **Creator.** **200** → [CreatorEpisode](#creatorepisode)`[]`.

#### `POST /api/v1/creator/series/{id}/episodes`

Adds an episode (comic) or chapter (novel). **Creator.**

```json
{
  "number": null,
  "title": "The flooded temple",
  "thumbnailUploadId": "<uuid of a finished THUMBNAIL upload>",
  "imageUploadIds": ["<PANEL upload 1>", "<PANEL upload 2>"],
  "creatorNote": "Thanks for reading!",
  "commentsEnabled": true,
  "fastPass": { "priceCoins": 5, "freeAfterDays": 7 },
  "publish": { "mode": "scheduled", "at": "2026-11-14T12:00:00Z" }
}
```

A novel chapter sends `blocks` instead of `imageUploadIds`:
`"blocks": [ { "type": "heading", "text": "Chapter 3" }, { "type": "paragraph", "text": "…" }, { "type": "scene-break" } ]`.

| Field | Rules |
|---|---|
| `number` | `null` takes the next free number; otherwise ≥ 1 and not taken (`400 number_taken`) |
| `title` | required, up to 120 characters |
| `imageUploadIds` | comics only, finished `PANEL` uploads in reading order: at most 100 images and 200 MB |
| `blocks` | novels only, up to 2000 blocks; `type` is `paragraph`, `heading`, `quote` or `scene-break`; `text` up to 20 000 characters |
| `creatorNote` | up to 1000 characters |
| `fastPass` | `null` = free. Otherwise `priceCoins` 3–10 (default 5) and `freeAfterDays` 1–90 (default 7) |
| `publish.mode` | `draft`, `now` or `scheduled` (then `publish.at` is a future instant) |

**201** → [EpisodeEdit](#episodeedit).
**Errors:** `400 number_taken` · `400 not_for_comics` (blocks on a comic) · `400 not_for_novels` (images on a
novel) · `400 too_many_images` · `400 episode_too_large` · `400 schedule_in_past` (field `publish.at`) ·
`400 upload_invalid` / `upload_not_ready` · `403 not_your_series`.

#### `GET /api/v1/creator/series/{id}/episodes/{number}`

One episode as the edit form shows it. **Creator.** **200** → [EpisodeEdit](#episodeedit).
**Errors:** `404 episode_not_found`.

#### `PUT /api/v1/creator/series/{id}/episodes/{number}`

Edits an episode: send the whole episode. A published episode stays published (`publish.mode: "now"`); drafts and
scheduled episodes can change mode. **Creator.** **200** → [EpisodeEdit](#episodeedit).
**Errors:** as create, plus `400 number_fixed` (the number cannot change) · `409 episode_hidden` (an admin took it
down).

#### `DELETE /api/v1/creator/series/{id}/episodes/{number}`

Deletes a draft or scheduled episode. **Creator.** **204.** **Errors:** `409 episode_published` (live episodes cannot
be deleted).

### Media uploads

Images go straight from the browser to storage (Cloudflare R2, or local S3 storage in development) with a presigned
URL; the API never receives the file.

1. `POST /api/v1/creator/uploads` with the kind, type and size → an upload ticket.
2. `PUT` the file to `uploadUrl` with exactly the `headers` from the ticket (within 15 minutes).
3. `POST /api/v1/creator/uploads/{id}/complete` → the API checks the image and makes WebP variants.
4. Use the upload `id` in a series, episode or avatar request.

Image rules by kind:

| `kind` | Minimum width | Square | Used for |
|---|---|---|---|
| `COVER` | 600 px | no | series cover |
| `BANNER` | 800 px | no | series banner |
| `THUMBNAIL` | 300 px | yes | episode thumbnail |
| `PANEL` | 800 px | no | comic panels |
| `AVATAR` | 200 px | yes | profile picture (any signed-in user) |

All kinds: `image/jpeg` or `image/png`, 1 byte to 20 MB, at most 50 megapixels. Variants are made at 320, 800 and
1200 px wide.

#### `POST /api/v1/creator/uploads`

Starts an image upload. **Creator**, or any signed-in user for `kind: "AVATAR"`.

```json
{ "kind": "PANEL", "contentType": "image/png", "size": 2457600 }
```

**201** → [UploadTicket](#uploadticket) `{ "id", "uploadUrl", "headers", "expiresAt" }`.
**Errors:** `400 unsupported_type` · `400 file_too_large`.

#### `POST /api/v1/creator/uploads/{id}/complete`

Checks the uploaded image and makes its WebP variants. **Signed in** (the upload's owner). Calling it again after
success gives the same answer.
**200** → [UploadView](#uploadview) with `status: "READY"`.
**Errors:** `409 upload_missing` (the file is not in storage yet) · `422` with a reason code: `image_too_small`,
`not_square`, `unsupported_type`, `corrupt_image`, `file_too_large`, `too_many_pixels` · `404 upload_not_found`.

#### `GET /api/v1/creator/uploads/{id}`

The state of one of my uploads (`PENDING`, `READY` or `REJECTED` with `rejectCode`). **Signed in** (owner).
**200** → [UploadView](#uploadview). **Errors:** `404 upload_not_found`.

### Admin

Everything here needs the `ADMIN` role. Every change is written to the audit log with the admin, the reason and
the request id. Lists are newest first and [paged](#5-lists-and-pagination).

#### `GET /api/v1/admin/overview`

Counts for the admin start page (open reports, banned users, hidden content, refunded orders).
**200** → [Overview](#overview).

#### `GET /api/v1/admin/users`

Users. `q` searches email or name; `status`: `active`, `banned`, `deletion_pending` or `deleted`; plus paging.
**200** → page of [AdminUser](#adminuser).

#### `POST /api/v1/admin/users/{id}/ban`

Suspends an account and signs it out everywhere. Body: `{ "reason": "Spam comments" }` (required, up to 500
characters). **200** → [AdminUser](#adminuser).
**Errors:** `404 user_not_found` · `409 already_banned` · `409 cannot_ban_admin`.

#### `POST /api/v1/admin/users/{id}/unban`

Lifts a suspension. Body (optional): `{ "reason": "…" }`. **200** → [AdminUser](#adminuser).
**Errors:** `404 user_not_found` · `409 not_banned`.

#### `GET /api/v1/admin/content`

Series, episodes or comments.

| Parameter | Values |
|---|---|
| `type` | required: `series`, `episode` or `comment` |
| `q` | text search (optional) |
| `status` | a state of that type, e.g. `published` or `hidden` (optional) |
| `cursor`, `limit` | paging |

**200** → page of [AdminContent](#admincontent).

#### `POST /api/v1/admin/content/{type}/{id}/hide`

Takes live content down (`type`: `series`, `episode` or `comment`); its open reports are resolved. Body:
`{ "reason": "…" }` (required). **204.** **Errors:** `404 content_not_found` · `409 not_hideable`.

#### `POST /api/v1/admin/content/{type}/{id}/restore`

Puts hidden content back. Body (optional): `{ "reason": "…" }`. **204.**
**Errors:** `404 content_not_found` · `409 not_hidden`.

#### `GET /api/v1/admin/reports`

The report queue. `status`: `open`, `resolved` or `dismissed` (omit for all); plus paging.
**200** → page of [AdminReport](#adminreport).

#### `POST /api/v1/admin/reports/{id}/settle`

Settles a report.

```json
{ "action": "hide", "note": "Spoilers in the first line." }
```

`action`: `dismiss`, `resolve` or `hide` (also hides the reported content). `note`: optional, up to 1000 characters.
**200** → [AdminReport](#adminreport).
**Errors:** `404 report_not_found` · `409 report_closed` (another admin settled it) · `400 missing_target`.

#### `GET /api/v1/admin/orders`

Coin orders. `q` searches order number, email or name; `status`: `pending`, `paid`, `failed`, `cancelled`,
`expired` or `refunded`; plus paging. **200** → page of [AdminOrder](#adminorder).

#### `POST /api/v1/admin/orders/{id}/refund`

Refunds a paid order: its coins are taken back through the ledger. Body: `{ "reason": "…" }` (required). **200** → [RefundResult](#refundresult).
**Errors:** `404 order_not_found` · `409 order_not_refundable` (not paid, or already refunded) · `409 coins_spent`
(the reader already spent some of the coins).

#### `GET /api/v1/admin/audit`

The audit log. `action`: an action prefix, e.g. `user.` or `order.refund`; `actor`: an admin's user id; plus paging.
**200** → page of [AuditEntry](#auditentry).

---

## 10. Data types

Generated from `backend/openapi/openapi.json` (the `components.schemas` section). A `?` means the field may be
left out; `| null` means it may be `null`. Paged answers are `{ items: T[]; nextCursor: string | null }`
(`CursorPage<T>` in the OpenAPI file). In TypeScript, use the generated types instead of copying these:
`import type { components } from "@/lib/api/schema"` and `components["schemas"]["SeriesCard"]`.

### AdminContent

```ts
interface AdminContent {
  createdAt: string;                         // ISO 8601 instant
  episodeNumber?: number | null;
  id: string;                                // uuid
  openReports: number;
  owner: string;
  seriesSlug: string;
  status: string;
  title: string;
  type: "series" | "episode" | "comment";
}
```

### AdminOrder

```ts
interface AdminOrder {
  coins: number;
  createdAt: string;                         // ISO 8601 instant
  displayName: string;
  email: string;
  id: string;                                // uuid
  method: string;
  orderNumber: string;
  paidAt?: string | null;                    // ISO 8601 instant
  priceKhr?: number | null;
  priceUsdCents?: number | null;
  refundable: boolean;
  refundedAt?: string | null;                // ISO 8601 instant
  status: string;
  userId: string;                            // uuid
}
```

### AdminReport

```ts
interface AdminReport {
  createdAt: string;                         // ISO 8601 instant
  details?: string | null;
  id: string;                                // uuid
  note?: string | null;
  reason: string;
  reporter: string;
  resolvedAt?: string | null;                // ISO 8601 instant
  resolvedBy?: string | null;
  status: string;
  target: ReportTarget;
}
```

### AdminUser

```ts
interface AdminUser {
  createdAt: string;                         // ISO 8601 instant
  displayName: string;
  email: string;
  id: string;                                // uuid
  lastLoginAt?: string | null;               // ISO 8601 instant
  roles: string[];
  status: string;
}
```

### AuditEntry

```ts
interface AuditEntry {
  action: string;
  actorId?: string | null;                   // uuid
  actorName?: string | null;
  createdAt: string;                         // ISO 8601 instant
  details: Record<string, unknown>;
  id: number;
  requestId?: string | null;
  targetId?: string | null;
  targetType: string;
}
```

### AvatarRequest

```ts
interface AvatarRequest {
  uploadId: string;                          // uuid
}
```

### Badges

```ts
interface Badges {
  isNew: boolean;
  up: boolean;
}
```

### BecomeCreatorRequest

```ts
interface BecomeCreatorRequest {
  acceptTerms: boolean;
  penName: string;                           // max 60 chars
}
```

### BecomeCreatorResponse

```ts
interface BecomeCreatorResponse {
  penName: string;
}
```

### Block

```ts
interface Block {
  text?: string | null;                      // max 20000 chars
  type: string;                              // not empty; pattern paragraph|heading|quote|scene-break
}
```

### BlockView

```ts
interface BlockView {
  text?: string | null;
  type: string;
}
```

### BookmarkState

```ts
interface BookmarkState {
  bookmarked: boolean;
}
```

### ChangeEmailRequest

```ts
interface ChangeEmailRequest {
  newEmail: string;                          // max 254 chars; pattern ^[^\s@]+@[^\s@]+\.[^\s@]+$
  password: string;                          // max 128 chars
}
```

### ChangePasswordRequest

```ts
interface ChangePasswordRequest {
  currentPassword: string;                   // max 128 chars
  newPassword: string;                       // max 128 chars
}
```

### Checkout

```ts
interface Checkout {
  abaDeeplink?: string | null;
  formAction?: string | null;
  formFields?: Record<string, string> | null;
  qrImage?: string | null;
  qrString?: string | null;
}
```

### CodeRequest

```ts
interface CodeRequest {
  code: string;                              // not empty; pattern \d{6}
}
```

### CoinPack

```ts
interface CoinPack {
  bonus: number;
  coins: number;
  id: number;
  priceKhr?: number | null;
  priceUsdCents?: number | null;
  tag?: "popular" | "best_value" | null;
}
```

### CoinShop

```ts
interface CoinShop {
  methods: ("khqr" | "aba" | "card")[];
  orderExpiryMinutes: number;
  packs: CoinPack[];
  simulator: boolean;
}
```

### CommentAuthor

```ts
interface CommentAuthor {
  avatarUrl?: string | null;
  name: string;
}
```

### CommentLikeState

```ts
interface CommentLikeState {
  liked: boolean;
  likes: number;
}
```

### CommentRequest

```ts
interface CommentRequest {
  body: string;                              // max 2000 chars
}
```

### CommentView

```ts
interface CommentView {
  author: CommentAuthor;
  body: string;
  canDelete: boolean;
  createdAt: string;                         // ISO 8601 instant
  id: string;                                // uuid
  liked: boolean;
  likes: number;
  mine: boolean;
  top: boolean;
}
```

### CreateUploadRequest

```ts
interface CreateUploadRequest {
  contentType: string;                       // not empty
  kind: "COVER" | "BANNER" | "THUMBNAIL" | "PANEL" | "AVATAR";
  size: number;
}
```

### CreatorDashboard

```ts
interface CreatorDashboard {
  creator: boolean;
  name?: string | null;
  series: CreatorSeries[];
  totals: CreatorTotals;
}
```

### CreatorEpisode

```ts
interface CreatorEpisode {
  commentsEnabled: boolean;
  freeAt?: string | null;                    // ISO 8601 instant
  likes: number;
  number: number;
  priceCoins?: number | null;
  publishedAt?: string | null;               // ISO 8601 instant
  status: string;
  thumbnailUrl?: string | null;
  title: string;
  views: number;
}
```

### CreatorSeries

```ts
interface CreatorSeries {
  comments: number;
  earnedCoins: number;
  series: SeriesCard;
  subscribers: number;
  unlocks: number;
  visibility: "draft" | "published" | "hidden";
}
```

### CreatorTotals

```ts
interface CreatorTotals {
  comments: number;
  earnedCoins: number;
  likes: number;
  series: number;
  subscribers: number;
  unlocks: number;
  views: number;
}
```

### DeletionResponse

```ts
interface DeletionResponse {
  deleteAfter: string;                       // ISO 8601 instant
}
```

### Device

```ts
interface Device {
  browser?: string | null;
  current: boolean;
  id: string;                                // uuid
  lastActiveAt: string;                      // ISO 8601 instant
  signedInAt: string;                        // ISO 8601 instant
  system?: string | null;
}
```

### DeviceList

```ts
interface DeviceList {
  items: Device[];
}
```

### EmailChangeResponse

```ts
interface EmailChangeResponse {
  codeExpiresInSeconds: number;
  email: string;
  resendAfterSeconds: number;
}
```

### EmailRequest

```ts
interface EmailRequest {
  email: string;                             // max 254 chars; pattern ^[^\s@]+@[^\s@]+\.[^\s@]+$
}
```

### EpisodeContent

```ts
interface EpisodeContent {
  blocks: NovelBlock[];
  comments: number;
  commentsEnabled: boolean;
  creatorNote?: string | null;
  episode: EpisodeSummary;
  next?: EpisodeSummary;
  panels: Panel[];
  previous?: EpisodeSummary;
  series: SeriesCard;
  total: number;
  viewer: ReaderState;
  wordCount: number;
}
```

### EpisodeEdit

```ts
interface EpisodeEdit {
  blocks: BlockView[];
  commentsEnabled: boolean;
  creatorNote?: string | null;
  freeAfterDays?: number | null;
  freeAt?: string | null;                    // ISO 8601 instant
  number: number;
  panels: PanelView[];
  priceCoins?: number | null;
  publishedAt?: string | null;               // ISO 8601 instant
  status: string;
  thumbnailUrl?: string | null;
  title: string;
  wordCount: number;
}
```

### EpisodeInput

```ts
interface EpisodeInput {
  blocks?: Block[] | null;                   // max 2000 items
  commentsEnabled?: boolean | null;
  creatorNote?: string | null;               // max 1000 chars
  fastPass?: FastPass;
  imageUploadIds?: string[] | null;          // max 100 items
  number?: number | null;                    // min 1
  publish: Publish;
  thumbnailUploadId?: string | null;         // uuid
  title: string;                             // max 120 chars
}
```

### EpisodeLikeState

```ts
interface EpisodeLikeState {
  liked: boolean;
  likes: number;
}
```

### EpisodeSummary

```ts
interface EpisodeSummary {
  access: "free" | "fastpass";
  date: string;                              // YYYY-MM-DD
  isUp: boolean;
  likes: number;
  n: number;
  price?: number | null;
  thumb?: string | null;
  title: string;
}
```

### ErrorDetail

```ts
interface ErrorDetail {
  code: string;
  fields?: Record<string, string> | null;
  freeOn?: string | null;                    // YYYY-MM-DD
  message: string;
  price?: number | null;
  retryAfterSeconds?: number | null;
}
```

### ErrorResponse

Body of every error response.

```ts
interface ErrorResponse {
  error: ErrorDetail;
}
```

### FastPass

```ts
interface FastPass {
  freeAfterDays?: number | null;             // 1-90
  priceCoins?: number | null;                // 3-10
}
```

### FollowedCreator

```ts
interface FollowedCreator {
  followedAt: string;                        // ISO 8601 instant
  id: string;                                // uuid
  name: string;
  seriesCount: number;
}
```

### FollowState

```ts
interface FollowState {
  followers: number;
  following: boolean;
}
```

### GenreItem

```ts
interface GenreItem {
  name: string;
  seriesCount: number;
  slug: string;
}
```

### HealthResponse

```ts
interface HealthResponse {
  database: "UP" | "DOWN";
  status: "UP" | "DOWN";
}
```

### HeroSlide

```ts
interface HeroSlide {
  blurb: string;
  series: string;
  seriesData: SeriesCard;
  tag: string;
}
```

### HistoryEntry

```ts
interface HistoryEntry {
  episode: number;
  lastRead: number;
  progress: number;                          // decimal
  readAt: string;                            // ISO 8601 instant
  series: string;
  seriesData: SeriesCard;
}
```

### HomeFeed

```ts
interface HomeFeed {
  byGenre: Record<string, SeriesCard[]>;
  creatorCovers: SeriesCard[];
  daily: Record<string, SeriesCard[]>;
  genres: string[];
  hero: HeroSlide[];
  novels: SeriesCard[];
  rankings: HomeRankings;
  today: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
}
```

### HomeRankings

```ts
interface HomeRankings {
  comics: RankingEntry[];
  novels: RankingEntry[];
}
```

### ImageVariant

```ts
interface ImageVariant {
  url: string;
  width: number;
}
```

### LedgerEntry

```ts
interface LedgerEntry {
  amount: number;
  balanceAfter: number;
  createdAt: string;                         // ISO 8601 instant
  episode?: LedgerEpisode;
  id: number;
  note?: string | null;
  orderNumber?: string | null;
  reason: "purchase" | "bonus" | "unlock" | "refund" | "adjustment";
}
```

### LedgerEpisode

```ts
interface LedgerEpisode {
  n: number;
  series: string;
  title: string;
}
```

### LoginRequest

```ts
interface LoginRequest {
  email: string;                             // max 254 chars; pattern ^[^\s@]+@[^\s@]+\.[^\s@]+$
  password: string;                          // max 128 chars
  remember?: boolean | null;
}
```

### MeResponse

```ts
interface MeResponse {
  avatarUrl?: string | null;
  displayName: string;
  email: string;
  emailVerified: boolean;
  id: string;                                // uuid
  roles: string[];
}
```

### NotificationsChange

```ts
interface NotificationsChange {
  episodes?: boolean | null;
  fastPass?: boolean | null;
}
```

### NotificationSettings

```ts
interface NotificationSettings {
  episodes: boolean;
  fastPass: boolean;
}
```

### NovelBlock

```ts
interface NovelBlock {
  text?: string | null;
  type: "paragraph" | "heading" | "quote" | "scene-break";
}
```

### OptionalReasonRequest

```ts
interface OptionalReasonRequest {
  reason?: string | null;                    // max 500 chars
}
```

### OrderRequest

```ts
interface OrderRequest {
  method: "khqr" | "aba" | "card";
  packId: number;
}
```

### OrderView

```ts
interface OrderView {
  bonusCoins: number;
  checkout?: Checkout;
  coins: number;
  createdAt: string;                         // ISO 8601 instant
  expiresAt: string;                         // ISO 8601 instant
  firstBonusCoins: number;
  method: "khqr" | "aba" | "card";
  orderNumber: string;
  packId: number;
  paidAt?: string | null;                    // ISO 8601 instant
  priceKhr?: number | null;
  priceUsdCents?: number | null;
  provider: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "expired" | "refunded";
  totalCoins: number;
}
```

### Overview

```ts
interface Overview {
  bannedUsers: number;
  hiddenComments: number;
  hiddenEpisodes: number;
  hiddenSeries: number;
  openReports: number;
  refundedOrders: number;
}
```

### Panel

```ts
interface Panel {
  alt: string;
  height: number;
  src: string;
  width: number;
}
```

### PanelView

```ts
interface PanelView {
  height: number;
  uploadId: string;                          // uuid
  url: string;
  width: number;
}
```

### PasswordRequest

```ts
interface PasswordRequest {
  password: string;                          // max 128 chars
}
```

### ProfileRequest

```ts
interface ProfileRequest {
  displayName: string;                       // max 60 chars
}
```

### ProgressRequest

```ts
interface ProgressRequest {
  episode: number;                           // min 1
  progress: number;                          // decimal; 0-1
}
```

### Publish

```ts
interface Publish {
  at?: string | null;                        // ISO 8601 instant
  mode: "draft" | "now" | "scheduled";
}
```

### RankingEntry

```ts
interface RankingEntry {
  previousRank?: number | null;
  rank: number;
  series: SeriesCard;
}
```

### ReaderChange

```ts
interface ReaderChange {
  font?: "sans" | "serif" | null;
  size?: number | null;
  theme?: "light" | "sepia" | "dark" | null;
  wide?: boolean | null;
}
```

### ReaderSettings

```ts
interface ReaderSettings {
  font: "sans" | "serif";
  size: number;
  theme: "light" | "sepia" | "dark";
  wide: boolean;
}
```

### ReaderState

```ts
interface ReaderState {
  bookmarked: boolean;
  liked: boolean;
  signedIn: boolean;
  unlocked: boolean;
}
```

### ReasonRequest

```ts
interface ReasonRequest {
  reason: string;                            // max 500 chars
}
```

### RefundResult

```ts
interface RefundResult {
  order: AdminOrder;
  refundedCoins: number;
}
```

### RemovedHistory

```ts
interface RemovedHistory {
  items: RemovedHistoryEntry[];
}
```

### RemovedHistoryEntry

```ts
interface RemovedHistoryEntry {
  episode: number;                           // min 1
  lastRead: number;                          // min 1
  progress: number;                          // decimal; 0-1
  readAt: string;                            // ISO 8601 instant
  seriesId: string;                          // uuid
}
```

### RemovedSubscription

```ts
interface RemovedSubscription {
  seriesId: string;                          // uuid
  subscribedAt: string;                      // ISO 8601 instant
}
```

### RemovedSubscriptions

```ts
interface RemovedSubscriptions {
  items: RemovedSubscription[];
}
```

### RemoveRequest

```ts
interface RemoveRequest {
  seriesIds: string[];                       // max 100 items
}
```

### ReportRequest

```ts
interface ReportRequest {
  details?: string | null;                   // max 1000 chars
  reason: string;                            // max 50 chars
}
```

### ReportTarget

```ts
interface ReportTarget {
  episodeNumber?: number | null;
  id: string;                                // uuid
  seriesSlug?: string | null;
  status?: string | null;
  title?: string | null;
  type: "series" | "episode" | "comment";
}
```

### ResetPasswordRequest

```ts
interface ResetPasswordRequest {
  password: string;                          // max 128 chars
  token: string;                             // max 200 chars
}
```

### RestoreHistoryRequest

```ts
interface RestoreHistoryRequest {
  items: RemovedHistoryEntry[];              // max 100 items
}
```

### RestoreSubscriptionsRequest

```ts
interface RestoreSubscriptionsRequest {
  items: RemovedSubscription[];              // max 100 items
}
```

### SearchResults

```ts
interface SearchResults {
  items: SeriesCard[];
}
```

### SeriesCard

```ts
interface SeriesCard {
  ageRating: "all" | "teen" | "mature";
  badges: Badges;
  cover?: string | null;
  creator: string;
  fastPassEpisodes: number;
  freeEpisodes: number;
  genre: string;
  id: string;                                // uuid
  language: string[];
  likes: number;
  slug: string;
  status: "ongoing" | "completed" | "hiatus";
  title: string;
  totalEpisodes: number;
  type: "comic" | "novel";
  updateDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" | null;
  views: number;
}
```

### SeriesDetail

```ts
interface SeriesDetail {
  creatorId: string;                         // uuid
  creatorSeriesCount: number;
  related: SeriesCard[];
  series: SeriesCard;
  stats: SeriesStats;
  synopsis: string;
}
```

### SeriesEdit

```ts
interface SeriesEdit {
  ageRating: "all" | "teen" | "mature";
  bannerUrl?: string | null;
  coverUrl?: string | null;
  genre: string;
  id: string;                                // uuid
  languages: string[];
  slug: string;
  status: "ongoing" | "completed" | "hiatus";
  summary: string;
  tags: string[];
  title: string;
  type: "comic" | "novel";
  updateDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" | null;
  visibility: "draft" | "published" | "hidden";
}
```

### SeriesInput

```ts
interface SeriesInput {
  ageRating?: "all" | "teen" | "mature" | null;
  bannerUploadId?: string | null;            // uuid
  coverUploadId?: string | null;             // uuid
  genre: string;                             // not empty
  languages: string[];                       // each matches en|km
  status?: "ongoing" | "completed" | "hiatus" | null;
  summary?: string | null;                   // max 2000 chars
  tags?: string[] | null;                    // max 10 items
  title: string;                             // max 120 chars
  type?: "comic" | "novel" | null;
  updateDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" | null;
}
```

### SeriesStats

```ts
interface SeriesStats {
  comments: number;
  subscribers: number;
}
```

### SeriesViewer

```ts
interface SeriesViewer {
  followingCreator: boolean;
  lastEpisode?: number | null;
  lastRead: number;
  progress?: number | null;                  // decimal
  subscribed: boolean;
  unlocked: number[];
}
```

### Settings

```ts
interface Settings {
  language: "en" | "km";
  notifications: NotificationSettings;
  reader: ReaderSettings;
  theme: "system" | "light" | "dark";
}
```

### SettingsChange

```ts
interface SettingsChange {
  language?: "en" | "km" | null;
  notifications?: NotificationsChange;
  reader?: ReaderChange;
  theme?: "system" | "light" | "dark" | null;
}
```

### SettleRequest

```ts
interface SettleRequest {
  action: "dismiss" | "resolve" | "hide";
  note?: string | null;                      // max 1000 chars
}
```

### SignupRequest

```ts
interface SignupRequest {
  email: string;                             // max 254 chars; pattern ^[^\s@]+@[^\s@]+\.[^\s@]+$
  language?: string | null;                  // pattern en|km
  name: string;                              // 2-60 chars
  password: string;                          // max 128 chars
}
```

### SignupResponse

```ts
interface SignupResponse {
  codeExpiresInSeconds: number;
  email: string;
  resendAfterSeconds: number;
}
```

### SimulateRequest

```ts
interface SimulateRequest {
  outcome: "paid" | "failed";
}
```

### SubscriptionEntry

```ts
interface SubscriptionEntry {
  series: SeriesCard;
  subscribedAt: string;                      // ISO 8601 instant
}
```

### SubscriptionState

```ts
interface SubscriptionState {
  subscribed: boolean;
  subscribers: number;
}
```

### Suggestions

```ts
interface Suggestions {
  items: string[];
}
```

### TokenRequest

```ts
interface TokenRequest {
  token: string;                             // max 4096 chars
}
```

### UnlockedEntry

```ts
interface UnlockedEntry {
  episode: EpisodeSummary;
  series: SeriesCard;
  unlockedAt: string;                        // ISO 8601 instant
}
```

### UnlockResult

```ts
interface UnlockResult {
  alreadyUnlocked: boolean;
  balance: number;
  coins: number;
  episode: number;
}
```

### UploadTicket

```ts
interface UploadTicket {
  expiresAt: string;                         // ISO 8601 instant
  headers: Record<string, string>;
  id: string;                                // uuid
  uploadUrl: string;
}
```

### UploadView

```ts
interface UploadView {
  height?: number | null;
  id: string;                                // uuid
  kind: "COVER" | "BANNER" | "THUMBNAIL" | "PANEL" | "AVATAR";
  rejectCode?: string | null;
  rejectMessage?: string | null;
  status: "PENDING" | "READY" | "REJECTED";
  url?: string | null;
  variants: ImageVariant[];
  width?: number | null;
}
```

### VerifyRequest

```ts
interface VerifyRequest {
  code: string;                              // not empty; pattern \d{6}
  email: string;                             // max 254 chars; pattern ^[^\s@]+@[^\s@]+\.[^\s@]+$
}
```

### Wallet

```ts
interface Wallet {
  balance: number;
  firstPurchaseBonus: boolean;
}
```
