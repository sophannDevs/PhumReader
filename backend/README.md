# PhumReader API (Spring Boot)

The backend for the PhumReader website. Design and decisions: [../docs/BACKEND.md](../docs/BACKEND.md);
progress: [../docs/BACKEND_CHECKLIST.md](../docs/BACKEND_CHECKLIST.md).

Java 21, Spring Boot 4.1.2, Gradle 9.8.2 (wrapper), Supabase PostgreSQL 17, Flyway, springdoc-openapi.
**No Docker** anywhere: not for running, not for tests.

## Requirements

- Java 21 (for example Temurin 21). Gradle downloads itself through `gradlew`.
- For `bootRun`: the Supabase project `phumreader-dev` (session pooler). Tests need no database and no network.

## Setup

1. Copy `.env.example` to `.env` (git-ignored) and fill in `DB_URL`, `DB_USER` and `DB_PASSWORD` from Supabase:
   Project Settings > Database > Connection string > **Session pooler** (port 5432). Do not use the transaction
   pooler (port 6543): it does not support the prepared statements the Java driver uses.
2. `./gradlew bootRun` (Windows Command Prompt: `gradlew.bat bootRun`). The API listens on http://localhost:8080.
3. Check http://localhost:8080/api/v1/health → `{"status":"UP","database":"UP"}`.

The `dev` profile is the default and reads `.env`. A missing required setting stops the app with its name.

## Commands

| Command | What it does |
|---|---|
| `./gradlew bootRun` | Start the API (profile `dev`); Flyway creates or updates the tables first |
| `./gradlew bootRun --args='--spring.profiles.active=dev,seed'` | Same, and load the website's demo content (safe to repeat) |
| `./gradlew check` | Tests on an embedded PostgreSQL 17 (real binaries, no Docker), Spotless, ArchUnit, OpenAPI drift check |
| `./gradlew spotlessApply` | Format the Java code (google-java-format, AOSP style) |
| `./gradlew exportOpenApi` | Rewrite `openapi/openapi.json` from the code; then run `npm run api:gen` in the repo root |

After any controller or DTO change: `./gradlew exportOpenApi`, then `npm run api:gen`, and commit both files.
`./gradlew check` fails while `openapi/openapi.json` is out of date, `npm run api:check` while the TypeScript
types are.

## Demo accounts (after seeding)

| Email | Password | What it is |
|---|---|---|
| `reader@toonwave.app` | `Toonwave1!` | Demo reader Sokha Chan: 3 coins, four series in Continue reading |
| `creator@toonwave.app` | `Toonwave1!` | Chan Sreyleak, the demo's stand-in creator, owner of their series |

The other demo creators and commenters exist as accounts without a password (they cannot log in).

## Useful addresses (dev)

- http://localhost:8080/api/v1/health: health, also through the website at http://localhost:3000/api/v1/health
- http://localhost:8080/actuator/health: Spring health details
- http://localhost:8080/swagger-ui.html: API explorer (off in `prod`)
- Public catalog (needs the seeded demo): http://localhost:3000/api/v1/home,
  `/api/v1/series/glass-compass`, `/api/v1/series/glass-compass/episodes?sort=newest`, `/api/v1/rankings?kind=novels`,
  `/api/v1/genres`, `/api/v1/series?genre=sci-fi`, `/api/v1/search?q=glass`

## Code layout

```
src/main/java/app/phumreader/
  PhumReaderApplication.java
  config/        settings (AppProperties), security, OpenAPI
  common/        error body + exception handler, request id, cursor paging, health check
  auth/ user/ series/ episode/ library/ coin/ payment/ comment/
  search/ notification/ media/ admin/        one package per feature (see each package-info.java)
src/main/resources/
  application.yml, application-dev.yml, application-prod.yml, db/migration/ (Flyway: V1__init.sql)
src/main/java/app/phumreader/seed/   demo content loader (profile seed)
src/test/java/app/phumreader/
  ArchitectureTest, OpenApiContractTest, support/IntegrationTest (embedded PostgreSQL + MockMvc)
openapi/openapi.json   API contract (committed)
```

Inside a feature: `web` (controllers + request/response records) → `service` → `repository` / `domain`.
`ArchitectureTest` enforces it.

## API rules

- Base path `/api/v1`, JSON only. Every error: `{"error": {"code": "snake_case", "message": "…", "fields"?: {…}}}`.
- Every response carries `X-Request-Id` (also in each log line).
- Lists use cursor paging: `?cursor=&limit=` → `{ "items": [...], "nextCursor": "…" | null }`.
- Catalog answers use the website's field names (`src/data/types.ts`) with raw values: counts as numbers, days as
  ISO dates in Asia/Phnom_Penh; the website formats them for English and Khmer.
- Writes need the CSRF header `X-XSRF-TOKEN` (value of the `XSRF-TOKEN` cookie).
