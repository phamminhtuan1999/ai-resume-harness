# ApplyWise Architecture Diagrams

These diagrams describe **ApplyWise**, the application that lives under `apps/`
(the repo's top-level README documents the *Harness* tooling, not the app).
ApplyWise is an AI career copilot that imports a resume, analyzes its fit
against a job, and generates tailored suggestions, drafts, roadmaps, interview
prep, and an application tracker.

**Stack at a glance**

- **Web (`apps/web`)** — Next.js 16 App Router + React 19, Clerk auth,
  Tailwind v4 / shadcn UI, Zod. All mutations run through Next.js **Server
  Actions** and all reads through a server **Data Layer**, both talking to
  Supabase via the service-role client. The "AI" work (scoring, suggestions,
  drafts, roadmaps, interview prep) is done by **deterministic heuristic
  modules** (`*.mjs`), not an external LLM.
- **API (`apps/api`)** — FastAPI + Uvicorn (Python 3.11+). A focused
  microservice whose one real job is **resume file import**: it verifies a
  Clerk JWT, then converts uploaded PDF/DOCX/image files to Markdown with
  **docling**.
- **External services** — **Clerk** (authentication + JWKS) and **Supabase
  Postgres** (the single database). **docling** is an in-process third-party
  conversion library inside the API.

---

## Diagram 1 — System Architecture

High-level components and how they connect. The Next.js web app is also the
primary backend (Server Actions + Data Layer write/read Supabase directly with
the service role); the FastAPI service is called only for resume-file import,
authenticated with a Clerk bearer token.

```mermaid
---
config:
  look: handDrawn
  theme: forest
---
flowchart TD
    Browser["Browser (React 19 UI)"]

    subgraph Web["Next.js Web App — apps/web"]
        Middleware["Clerk Middleware (proxy.ts)"]
        Pages["App Router Pages (dashboard, resumes, jobs, matches, tracker)"]
        Actions["Server Actions (actions.ts)"]
        DataLayer["Data Layer (data/server.ts)"]
        Logic["Analysis & Generation Modules (match-analyzer, *-generator .mjs)"]
    end

    subgraph API["FastAPI Service — apps/api"]
        Router["Resumes Router (/api/resumes)"]
        AuthDep["JWT Auth Guard (auth.py)"]
        ImportSvc["Resume Import Service (docling)"]
    end

    subgraph Ext["External Services"]
        Clerk["Clerk Auth + JWKS"]
        Supabase[("Supabase Postgres")]
    end

    Browser --> Middleware
    Middleware -->|protect routes| Pages
    Pages -->|mutations| Actions
    Pages -->|reads| DataLayer
    Actions --> Logic
    Actions -->|service role| Supabase
    DataLayer -->|service role| Supabase
    Actions -->|upload + Bearer JWT| Router
    Router --> AuthDep
    Router --> ImportSvc
    Middleware -.session.-> Clerk
    AuthDep -->|verify via JWKS| Clerk
```

---

## Diagram 2 — Data Flow (Resume Import & Save)

The lifecycle of the only request that crosses every layer: a user uploads a
resume file. The Server Action authenticates the user, ensures their profile
row exists, forwards the file to FastAPI (which verifies the Clerk JWT and runs
docling), then persists the canonical Markdown to Supabase.

```mermaid
---
config:
  look: handDrawn
  theme: forest
---
sequenceDiagram
    actor User as Browser
    participant Action as Server Action (saveResumeAction)
    participant Clerk as Clerk Auth
    participant API as FastAPI (/api/resumes/import/preview)
    participant Docling as docling
    participant DB as Supabase Postgres

    User->>Action: Submit resume form (file + title)
    Action->>Clerk: getCurrentAppUser() / getToken()
    Clerk-->>Action: user identity + session JWT
    Action->>DB: upsert user_profiles (clerk_user_id)
    DB-->>Action: user_profile id
    Action->>API: POST file (Authorization: Bearer JWT)
    API->>Clerk: verify token via JWKS
    Clerk-->>API: signing key OK
    API->>Docling: convert file to Markdown
    Docling-->>API: canonical_markdown
    API-->>Action: ResumeImportPreview (status: succeeded)
    Action->>DB: insert into resumes (raw_text, source_*)
    DB-->>Action: row created
    Action-->>User: success + revalidate /resumes, /dashboard
```

---

## Diagram 3 — Data Model

The Supabase Postgres schema (migrations `0001`–`0007`). Every record is scoped
to a `user_profiles` row (keyed by Clerk user id). A `match` is the analysis hub:
it joins one resume and one job, and is the parent of suggestions, draft
versions, roadmaps, and interview prep. Applications are unique per
(user, job) and optionally link back to a match.

```mermaid
---
config:
  look: handDrawn
  theme: forest
---
erDiagram
    USER_PROFILES ||--o{ RESUMES : owns
    USER_PROFILES ||--o{ JOBS : owns
    USER_PROFILES ||--o{ MATCHES : owns
    USER_PROFILES ||--o{ RESUME_VERSIONS : owns
    USER_PROFILES ||--o{ ROADMAPS : owns
    USER_PROFILES ||--o{ INTERVIEW_PREPS : owns
    USER_PROFILES ||--o{ APPLICATIONS : owns

    RESUMES ||--o{ MATCHES : analyzed_in
    JOBS ||--o{ MATCHES : analyzed_in

    MATCHES ||--o{ RESUME_SUGGESTIONS : produces
    MATCHES ||--o{ RESUME_VERSIONS : produces
    MATCHES ||--o{ ROADMAPS : produces
    MATCHES ||--o{ INTERVIEW_PREPS : produces

    RESUMES ||--o{ RESUME_VERSIONS : basis_for
    JOBS ||--o{ RESUME_VERSIONS : targets

    JOBS ||--o| APPLICATIONS : tracked_as
    MATCHES |o--o{ APPLICATIONS : linked_to

    USER_PROFILES {
        uuid id PK
        text clerk_user_id UK
        text email
        text current_role
        text target_role
        numeric years_of_experience
    }
    RESUMES {
        uuid id PK
        uuid user_id FK
        text title
        text raw_text
        text source_type
        text import_status
        jsonb structured_json
    }
    JOBS {
        uuid id PK
        uuid user_id FK
        text company
        text title
        text raw_description
        jsonb structured_json
        text contact_email
    }
    MATCHES {
        uuid id PK
        uuid user_id FK
        uuid resume_id FK
        uuid job_id FK
        int overall_score
        jsonb strengths_json
        jsonb weaknesses_json
        jsonb missing_skills_json
    }
    RESUME_SUGGESTIONS {
        uuid id PK
        uuid match_id FK
        text suggested_text
        text truth_guard_status
        text user_action
    }
    RESUME_VERSIONS {
        uuid id PK
        uuid match_id FK
        uuid resume_id FK
        uuid job_id FK
        text content_markdown
    }
    ROADMAPS {
        uuid id PK
        uuid match_id FK
        text title
        jsonb roadmap_json
    }
    INTERVIEW_PREPS {
        uuid id PK
        uuid match_id FK
        jsonb questions_json
        jsonb study_plan_json
    }
    APPLICATIONS {
        uuid id PK
        uuid user_id FK
        uuid job_id FK
        uuid match_id FK
        text status
        date applied_date
    }
```
