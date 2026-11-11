# auth

Sign up, email codes, log in, access and refresh tokens, log out, password reset, Google and Facebook login (P3-02 to P3-04).

## Layout

| Package | Holds | May use |
|---|---|---|
| `web` | Controllers, request and response records | `service`, this feature's `domain`; other features' `web` response records |
| `service` | Business rules, transactions | `repository`, `domain`, other features' `service` and `domain` |
| `repository` | Database access | `domain` |
| `domain` | Entities, enums, value types | nothing above it |

## Main entry points

`AuthService` (sign up, log in), `TokenService` / `JwtService` (tokens), `SocialLoginService` (Google, Facebook), `AccessTokenFilter` (reads the access cookie).

## Talks to

`user` (accounts), `notification` (emails).

## Rules (checked by `ArchitectureTest`)

- A controller never uses a repository, and never returns or accepts an entity.
- A service never uses `web` or the servlet API.
- `repository` and `domain` never call `service` or `web`.
- Another feature may call this feature's `service` and `domain`, never its `repository`.
