# ApplyWise Architecture Contract

## Selected Stack

The MVP uses a monorepo with separated frontend and backend surfaces:

```text
apps/
  web/   Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Clerk
  api/   Python, FastAPI, AI orchestration, Supabase/Postgres access
docs/
  product/
  stories/
  decisions/
```

Frontend deployment target: Vercel.

Backend deployment target: Render, Fly.io, Railway, or a comparable Python API
host. The backend should remain deployable independently from the frontend.

Database target: Supabase Postgres.

Storage target: resume files are sensitive. The MVP may avoid retaining
original uploaded files after Docling conversion. If original file retention is
needed, store files only in private Supabase Storage with user-scoped access and
delete support.

AI model target: Gemini or another free-tier-friendly model first, with future
fallback options for OpenAI, Claude, or local models.

## Boundary Rules

- Protected browser routes require Clerk authentication.
- Protected API calls must verify Clerk identity before accessing user data.
- Unknown HTTP payloads, environment variables, database rows, and provider
  outputs must be parsed before entering application logic.
- Resume and job description raw text are sensitive and must not be logged in
  production.
- Resume source files are sensitive and must not be logged or passed to
  unrelated services.
- The frontend should consume API contracts instead of reaching into backend
  domain internals.
- The backend owns AI prompt orchestration, schema validation, retry behavior,
  resume import normalization, and persistence of generated analysis results.
- The backend owns Docling execution for PDF, DOCX, image, Markdown, and plain
  text resume imports.

## Runtime Responsibilities

| Surface | Owns | Does Not Own |
| --- | --- | --- |
| `apps/web` | App shell, routes, forms, client state, Clerk UI, rendered results, browser validation. | AI prompt execution, provider SDK details, direct database policy bypass. |
| `apps/api` | Auth verification, validation, persistence, resume import normalization, AI workflows, scoring, structured outputs. | Browser rendering or shadcn component state. |
| Supabase Postgres | User profile, resumes, jobs, matches, suggestions, versions, roadmaps, interview prep, tracker records. | Application authorization decisions without matching server checks. |

## Verification Ladder

Expected proof grows by story:

- Unit proof for pure scoring, schema parsing, Truth Guard, and status rules.
- Integration proof for authenticated APIs, persistence, file import
  normalization, ownership checks, and AI response validation.
- E2E proof for main browser workflows.
- Platform proof only when deployment, Vercel, host config, or environment
  behavior cannot be proven locally.

## Observability

Server request logs should use one canonical JSON log line per request with:

- timestamp
- level
- request_id
- user_id when known
- action
- duration_ms
- status_code
- message

Audit logs are product records. Application logs are operational records. Do
not use operational logs as a substitute for product audit behavior.
