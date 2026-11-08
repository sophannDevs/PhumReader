---
name: api-sync
description: "Verifies and synchronizes OpenAPI specifications between the Spring Boot backend and Next.js frontend TypeScript types."
---

# API Synchronization Skill

Use this skill when modifying backend endpoints, DTO models, or when consuming new backend APIs in the frontend.

## Procedures

### 1. Check for Drift
Before starting or after modifying backend controllers:
```bash
npm run api:check
```
If this exits with non-zero, the TypeScript schemas in `src/lib/api/schema.d.ts` do not match `backend/openapi/openapi.json`.

### 2. Regenerate TypeScript Schema
When backend endpoints or schemas change:
```bash
npm run api:gen
```
This updates `src/lib/api/schema.d.ts` from `backend/openapi/openapi.json`.

### 3. Validate Consumer Types
Ensure frontend queries and API client methods strictly use the generated types:
```bash
npm run typecheck
```

