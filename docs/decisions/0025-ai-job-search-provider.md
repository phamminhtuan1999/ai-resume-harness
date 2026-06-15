# AI Job Search Provider (Adzuna) and Cost-Safe Relevance Pipeline

Date: 2026-06-15

## Status

Accepted

## Context

Period 16 (Add Job / AI Job Intake Hub) adds live job search focused on
AI-engineering transition roles (US-073/074/075). No external job search
provider exists today — `firecrawl_client.py` only scrapes a single
user-supplied URL. Three things must be decided before implementation, because
they are external-system + new-public-contract choices:

1. **Which provider**, and how it is configured and swapped.
2. **The cost ceiling** — search must not fan out into an unbounded number of
   AI model calls. A 50-result search has to cost a small, predictable number
   of relevance + quick-match calls.
3. **The relevance thresholds** that decide which jobs are shown, hidden, or
   marked "possible".

ApplyWise is not a general job board (Principle 3) and AI relevance is a
distinct judgment from candidate match (Principle 2). The provider-abstraction
precedent already exists: `AI_PROVIDER` selects the model adapter (US-069), and
`firecrawl_*` settings show the external-key pattern.

## Decision

### Provider: Adzuna behind a swappable interface

- A `JobSearchProvider` interface lives in
  `apps/api/app/services/job_search/`. The concrete client is **Adzuna**,
  selected by `APPLYWISE_JOB_SEARCH_PROVIDER` (default `adzuna`). Credentials
  are `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` (empty by default).
- **Absence of keys is a state, not a crash**: the endpoint returns a friendly
  "search not configured" envelope and the UI keeps URL/Paste fully usable.
- A `FakeJobSearchProvider` drives contract tests; **no live key is required in
  CI**.
- Why Adzuna over JSearch/RapidAPI: free developer tier, simple `app_id` +
  `app_key` auth, broad coverage, stable REST/JSON pagination. JSearch
  aggregates more boards but couples to RapidAPI quota; the interface keeps the
  switch a config change, so we start with the simpler provider.

### Endpoint

`POST /api/jobs/search-ai`, authenticated and ownership-enforced like other
routers. Request `{ target_role, location, remote_only, experience_level,
filters }`; response `{ search_session_id, total_provider_results,
total_ai_related_results, jobs[] }`. Results are **transient** (not persisted)
until the user Saves (US-077); `search_session_id` correlates results and
activity events.

### Cost-safe pipeline (enforced server-side; the client cannot raise limits)

```text
Fetch ≤ JOB_SEARCH_FETCH_LIMIT (default 50)
→ normalize + dedup (external id / normalized URL)
→ deterministic local pre-filter (US-072, ZERO model calls) scores all
→ keep top JOB_SEARCH_PREFILTER_LIMIT (default 20) likely-AI jobs
→ AI Role Relevance on those ≤20 (default tier, US-067 reuse applies)
→ keep jobs ≥ relevance threshold
→ Candidate Quick Match on top JOB_SEARCH_QUICK_MATCH_LIMIT (default 8)
  (fast tier, US-068 reused pre-save)
```

The per-search model budget is **bounded and asserted** by a counting fake
client (≤20 relevance calls, ≤8 quick-match calls). Reuse (decision 0022) means
repeat searches over the same listings do not re-spend.

### Thresholds

Relevance score → bucket: **≥75 strong**, **60–74 possible**, **<60
hidden-by-default**. The bucket is exposed as a label. Hidden jobs retain their
`exclude_reason` so US-075 can reveal them under "show hidden jobs".

### Default filters (Applied AI Engineer path)

`only_ai_related`, `hide_research_heavy`, `hide_non_engineering_ai`,
`prioritize_transition_friendly` all default ON (Section 8). Research-heavy and
non-engineering AI roles are hidden by default but never silently discarded.

## Consequences

- Live AI-focused search with a predictable per-search model budget; provider
  swap is config-only.
- CI runs against the fake provider — no live key needed; live search requires
  Adzuna credentials in `apps/api/.env.local`.
- The deterministic pre-filter (US-072) is the spend guard before any model
  call; changing fetch/pre-filter/quick-match limits or thresholds is a change
  to **this record** and the settings defaults.
- Quick match runs **pre-save** here (no `jobs` row yet); its reuse identity is
  the normalized payload + profile (see US-074), not a saved job id.
