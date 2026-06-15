# Period 16 - Add Job / AI Job Intake Hub

## Goal

Turn the narrow Import Job page into a unified **Add Job** hub that helps a
software engineer transitioning into AI roles *find*, *import*, and *qualify*
jobs. Every intake path (search, URL, paste) flows through the same gate:
normalize → **AI Role Relevance Check** → lightweight **Candidate Quick Match
Preview** → Save / Save & Analyze / Open Apply Link. AI-relevance and candidate
match are kept as two distinct judgments. Research-heavy and non-engineering AI
roles are hidden by default for the Applied AI Engineer path but never silently
discarded.

Source input: `applywise_add_job_ai_intake_flow_user_stories.md`
(Add Job / Find or Import Job intake enhancement, 11 epics).

Intake: #51 (new initiative, high-risk lane — data model, external systems,
public contracts, existing behavior, multi-domain).

## Verification Against the Codebase

The source document was verified against the implementation before slicing.
Several of its epics are already partly built and get reduced or no new stories:

| Doc epic | Codebase reality | Slice impact |
| --- | --- | --- |
| 1. Refactor Import Job into Add Job hub | `/jobs/new` already renders a two-tab `JobIntake` (`job-intake.tsx`): "Add by URL" (`importJobByUrlAction` → `POST /api/jobs/import-url`, Firecrawl scrape + Gemini extraction) and "Paste manually" (`saveJobAction`, direct insert). | US-070 reframes the existing page and adds the third **Search AI Jobs** tab; it does not rebuild URL/paste. |
| 2. Search AI Jobs | **No external job search provider exists** (no Adzuna/Indeed/etc). Only `firecrawl_client.py` scrapes a single user-supplied URL. | Net-new: US-073 (provider + search endpoint), US-074 (AI enrichment), US-075 (results UI). Largest chunk. |
| 3. Import URL preview | URL import already extracts fields (`extraction_json`, confidence) but has **no AI relevance step** and no pre-save confirm preview. | US-076 adds the relevance preview + non-AI warning to the existing flow. |
| 4. Paste JD | `saveJobAction` is a **direct insert with no AI extraction**; `job_extraction` (`extract_job_from_markdown`) exists but is only wired to URL markdown. | US-076 routes pasted JD through AI extraction + relevance, then a confirm/edit step. |
| 5. AI Role Relevance filter | **Does not exist.** AI infra to add it is mature: `model_routing.TASK_TIER`, `BaseAIWorkflow`, native structured output, deterministic fallback, US-067 reuse. | US-072 — new `ai_role_relevance` workflow + local keyword pre-filter. |
| 6. Candidate Quick Match Preview | **Already exists** as `quick_match` (US-068): fast-tier `QuickMatchWorkflow`, `POST /api/jobs/{id}/quick-match`, output `likelihood/headline/confidence`, snapshot in `ai_workflow_runs`, US-067 reuse. But it runs on a **saved** job (job id + profile). | Reuse it. US-074 extends quick match to run on **pre-save** search/preview payloads (no job row yet); no new full workflow. |
| 7. Save / Analyze / Apply | Save (`saveJobAction`), full analysis (`matches` + `match_analysis`, `/matches/{id}`) exist. No external-source save, no "Open Apply Link", no analyze-from-intake. | US-077 adds save-external, Save & Analyze routing, Open Apply Link. |
| 8. Data model | `jobs` already has `source` (`manual`/`manual_url`), `source_url`, `normalized_url`, `employment_type`, `salary_range`, `extraction_*`. **No `discovered_api`, no `ai_relevance_*`, no `quick_match_*` columns.** | US-071 — additive migration; reconcile `source` taxonomy; decide jobs-columns vs `ai_workflow_runs` snapshot for persistence. |
| 9. API enhancements | `import-url` exists; `search-ai`, `extract-from-description`, `save-external` do not. | Endpoints land with their owning stories (US-073/076/077). |
| 10. Error/empty states | Generic patterns exist; search-specific empty/fallback states do not. | Folded into US-075. |
| 11. Activity tracking | `activity_feed` table + `activity-feed.mjs` exist; no intake-specific activity types. | US-077 adds search/import/save/apply activity events. |

Net: the genuinely new surface is the **external search provider + cost-safe AI
pipeline** and the **AI Role Relevance classifier**. The hub shell, quick match,
extraction, analysis, and activity infrastructure already exist and are reused.

## Stories

| Story | Title | Lane | Shape |
| --- | --- | --- | --- |
| US-070 | Add Job hub: reframe intake page + Search AI Jobs tab | normal | Flat story |
| US-071 | Job intake source taxonomy + AI relevance / quick-match persistence | high-risk | Flat story (data model) |
| US-072 | AI Role Relevance classifier + local keyword pre-filter | normal (stronger) | Flat story |
| US-073 | External AI job search provider + `POST /api/jobs/search-ai` | high-risk | Flat story (external system) |
| US-074 | Cost-safe AI enrichment of search results (relevance + quick match) | normal (stronger) | Flat story |
| US-075 | Search AI Jobs results UI + empty / provider-failure states | normal | Flat story |
| US-076 | URL + Paste JD: AI relevance preview, extraction, non-AI warning | normal | Flat story |
| US-077 | Save / Save & Analyze / Open Apply Link + intake activity events | normal | Flat story |

## Suggested Sequence

```text
US-071 (data model)            US-072 (relevance classifier)
        \                         /        \
         \                       /          \
          US-073 (search provider)           US-076 (URL/paste preview)
                     \                       /
                      US-074 (AI enrichment)
                             |
                      US-075 (search UI)
                             |
                      US-077 (save / analyze / apply + activity)
US-070 (hub shell) can land first or in parallel; it gates nothing but the UI home.
```

## Open Decisions (record during implementation)

These are flagged now, not pre-decided (BA-lead intake; "just add tasks"):

- **0024 — AI job search provider & cost-safe relevance pipeline.** Which
  provider (Adzuna vs alternative), keys/quota, fetch≤50 → local pre-filter →
  AI relevance on top ~20 → quick match on top ~5-8, relevance thresholds
  (≥75 strong / 60-74 possible / <60 hidden). External-system + new public
  contract → durable decision required (US-073/US-074).
- **0025 — Relevance/quick-match persistence shape.** Denormalize onto `jobs`
  columns (US-071 fields) vs keep the `ai_workflow_runs` snapshot as source of
  truth and mirror only display fields. Affects data ownership + reuse keys
  (US-071/US-072).
- **0026 — `source` taxonomy reconciliation.** Existing `manual`/`manual_url`
  vs doc's `discovered_api`/`manual_url`/`manual_paste`. Decide migration of
  existing rows and the canonical set (US-071).

## Validation Shape

Relevance classifier and the pre-filter are unit-heavy (keyword groups,
category mapping, threshold buckets, deterministic fallback, missing-data →
`insufficient_job_data`). The search provider needs integration proof
(normalize external payloads, dedup, cap, provider-failure envelope) plus a
fake-provider contract test so no live key is required in CI. The cost-safe
pipeline needs proof that AI runs are bounded (≤N relevance calls, ≤M quick
match calls per search) via a counting fake client. The hub, URL/paste preview,
and results UI need E2E that the gate (relevance + quick match) renders before
save and that non-AI jobs warn rather than vanish. Activity events asserted per
intake action. Existing deep analysis flow must still pass unchanged.
