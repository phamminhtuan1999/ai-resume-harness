# US-073 External AI Job Search Provider + `POST /api/jobs/search-ai`

## Status

planned

## Lane

high-risk

## Product Contract

A user who does not yet have a specific job can search live listings from a
public job provider, focused on AI-engineering transition roles, without leaving
ApplyWise. This story delivers the **provider integration and search endpoint**:
fetch from the configured provider, normalize external listings into ApplyWise's
internal job shape, dedup, and run the deterministic local keyword pre-filter
(US-072) to bound how many results proceed. It returns normalized, pre-filtered
results **without** AI relevance or quick match yet (those are US-074). Provider
failures degrade gracefully and never crash the page.

## Relevant Product Docs

- `applywise_add_job_ai_intake_flow_user_stories.md` (Epic 2, 9, 10, Section 14)
- `docs/product/ai-workflows.md`, `docs/product/data-model.md`
- `apps/api/app/services/firecrawl_client.py` (existing external-fetch pattern)

## Acceptance Criteria

- A configurable provider client (e.g. Adzuna) lives behind a small interface so
  the provider can be switched by configuration, mirroring the
  provider-abstraction precedent (`AI_PROVIDER` / US-069). Keys are read from
  settings; absence is handled with a clear "search not configured" state, not a
  crash.
- `POST /api/jobs/search-ai` accepts `{ target_role, location, remote_only,
  experience_level, filters }` (Section 9 request shape) and returns
  `{ search_session_id, total_provider_results, total_ai_related_results, jobs[]
  }`. In this story `jobs[]` carries normalized fields + local pre-score; the
  `ai_relevance` / `quick_match` objects are added by US-074.
- External listings are normalized into the internal job shape (title, company,
  location, description, apply_url, external_source, external_job_id,
  external_posted_at, external_raw_payload) and deduplicated.
- The cost-safe cap is enforced server-side: fetch up to ~50, locally pre-score
  all, and only the top ~20 likely-AI jobs are eligible to proceed downstream;
  the cap is configurable and never bypassable by the client.
- Default search filters favor the Applied AI Engineer path (only AI-related ON,
  hide research-heavy ON, hide non-engineering AI ON, prioritize
  transition-friendly ON) per Section 8.
- Provider failure returns a friendly, retryable error envelope; auth/ownership
  is enforced on the endpoint like other authenticated routers.
- No live provider key is required for tests: a fake provider drives contract
  tests.

## Design Notes

- Commands: optional settings in `apps/api/app/settings.py`
  (`JOB_SEARCH_PROVIDER`, provider key, `JOB_SEARCH_FETCH_LIMIT`,
  `JOB_SEARCH_PREFILTER_LIMIT`).
- Queries: none persisted yet (search results are transient until saved by
  US-077); a `search_session_id` correlates results for the response/activity.
- API: `POST /api/jobs/search-ai` in `apps/api/app/routers/jobs.py`; new
  `apps/api/app/services/job_search/` provider client + normalizer.
- Tables: none new (results not persisted until Save); reuses US-071 columns at
  save time.
- Domain rules: ApplyWise is not a general job board (Principle 3); default to
  AI-focused, transition-friendly results; deterministic pre-filter bounds AI
  spend before any model call.
- UI surfaces: none (UI is US-075); this story is provider + endpoint only.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-073 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Normalizer maps provider payload → internal shape; dedup; default-filter application; cap/limit math; request validation. |
| Integration | `search-ai` with a fake provider: auth/ownership, normalized + pre-filtered response, cap enforced server-side, friendly envelope on provider failure, "not configured" path. |
| E2E | Exercised via US-075 once the UI exists. |
| Platform | n/a |
| Release | Search latency bounded; zero AI model calls in this story (pre-filter only). |

## Harness Delta

Intake #51. **Decision 0024 required** (provider choice + cost-safe pipeline +
thresholds) — external system + new public contract. Record via
`docs/decisions/0024-*.md` and `scripts/bin/harness-cli decision add` before
implementation. Add provider env vars to `apps/api/.env.local` docs without
printing secrets.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
