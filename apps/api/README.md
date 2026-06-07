# ApplyWise API

FastAPI backend for ApplyWise resume import and AI workflows.

## Getting started

From the repo root:

```bash
# 1. Create the virtualenv and install dependencies (incl. dev tools)
npm run setup:api

# 2. Configure environment
cp apps/api/.env.example apps/api/.env.local
# then fill in CLERK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# 3. Run the dev server (http://localhost:8000, hot-reload)
npm run dev:api
```

`GET /health` should return `{"status":"ok","service":"applywise-api"}`.
Interactive docs are at http://localhost:8000/docs (development only).

## Configuration

Settings are loaded from `apps/api/.env.local` (see `app/settings.py`).
`.env.example` is a template only — it is never read by the app. Keys:

| Key | Purpose |
| --- | --- |
| `APPLYWISE_API_ENV` | `development` enables `/docs` |
| `APPLYWISE_ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `http://localhost:3000`) |
| `RESUME_IMPORT_MAX_BYTES` | Max upload size for resume import |
| `RESUME_IMPORT_TIMEOUT_SECONDS` | Resume import timeout |
| `CLERK_SECRET_KEY` | Clerk server key |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase service credentials |

## Running tests

```bash
cd apps/api && .venv/bin/python -m pytest
```
