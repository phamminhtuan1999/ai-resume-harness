# 0007 ApplyWise MVP Monorepo

Date: 2026-06-05

## Status

Accepted

## Context

`SPEC.md` selects a serious SaaS MVP for ApplyWise with a Next.js and shadcn/ui
frontend, Clerk authentication, Supabase Postgres, and a Python/FastAPI backend
preferred for AI workflows.

The repository currently contains only the Harness operating layer and the
source spec. Before scaffolding application code, future agents need a stable
shape for where frontend, backend, product docs, and validation should land.

The product has several hard boundaries:

- Auth and protected user data.
- Sensitive resume and job description text.
- External AI provider calls.
- Structured AI response validation.
- Supabase/Postgres persistence.
- Vercel-hosted frontend deployment.

## Decision

Build ApplyWise as a monorepo with separated frontend and backend applications:

```text
apps/
  web/   Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Clerk
  api/   Python, FastAPI, AI orchestration, Supabase/Postgres access
docs/
  product/
  stories/
  decisions/
```

The frontend should deploy to Vercel. The backend should remain a separate
Python service deployable to Render, Fly.io, Railway, or a comparable API host.

The frontend should not own AI provider details or database policy bypass. The
backend owns auth verification for protected API calls, schema validation,
persistence, scoring, AI prompt orchestration, and retry behavior.

## Alternatives Considered

1. Single Next.js full-stack app. Rejected for MVP direction because the spec
   explicitly prefers Python/FastAPI for AI workflows and portfolio value.
2. Backend-only scaffold first. Rejected because Period 1 requires user-visible
   auth, dashboard, profile, resume, and job input flows.
3. Many-service architecture. Rejected for MVP because the spec says the MVP
   should not split into too many services.
4. Monorepo with `apps/web` and `apps/api`. Accepted because it keeps frontend
   and backend boundaries clear while preserving one coordinated repository.

## Consequences

Positive:

- Frontend and backend can evolve independently while sharing product docs and
  story validation.
- The AI workflow can use Python ecosystem strengths without forcing the
  browser app to own provider orchestration.
- The Vercel frontend path remains straightforward.
- Future Go services can be added without disrupting the MVP core.

Tradeoffs:

- Local development will need both a frontend dev server and a backend API
  server.
- Auth verification must be implemented consistently between Clerk and the
  FastAPI service.
- Cross-app environment setup must be documented carefully.
- E2E proof will need to cover browser, API, and database boundaries.

## Follow-Up

- Scaffold `apps/web` with Next.js App Router, TypeScript, Tailwind CSS, and
  shadcn/ui.
- Scaffold `apps/api` with FastAPI and typed request/response schemas.
- Add environment templates without committing secrets.
- Create migration or schema artifacts for Supabase Postgres when Period 1 data
  implementation begins.
- Use Browser verification after starting the frontend dev server.
