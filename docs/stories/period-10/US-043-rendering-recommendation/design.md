# Design

## Domain Model

**PagePolicy** (frozen dataclass, `app/services/export/page_policy.py`) — the
server-authoritative length contract for one generation:

- `target_pages: int` (1–3), `max_pages: int` (1–3, ≥ target band rules
  below), `yoe: float | None`, `yoe_source: 'profile' | 'parsed_work_history'
  | 'unknown'`, `seniority_signal: str | None`, `exceptional: bool`,
  `evidence_volume: int`, `basis: str` (human-readable, e.g. "4 years of
  experience (profile)"), `notes: list[str]` (quality-note codes).

Band normalization (brief rules + SE default, decision 0014 §1):

| yoe | target | max |
| --- | --- | --- |
| unknown | 1 | 2 (+ `yoe_unknown` note) |
| 0 ≤ y < 3 | 1 | 1 |
| 3 ≤ y < 5 | 1 | 2 if evidence-volume trigger else 1 |
| 5 ≤ y < 8 | 1 | 2 |
| 8 ≤ y < 12 | 2 if seniority signal or evidence trigger else 1 | 2 |
| y ≥ 12 | 2 | 3 if exceptional gate else 2 |

Mechanical proxies (never the model's say-so):

- **Evidence-volume trigger**: profile work bullet_points + project
  key_features count ≥ 18, or ≥ 4 work entries.
- **Seniority signal**: case-insensitive keyword in the job title or the
  candidate's current/most-recent title: senior, staff, lead, principal,
  manager, head, architect; or `jobs.structured_json.seniority`-like fields
  when present (optional enrichment — absence never blocks).
- **Exceptional gate** (12+ only): principal / staff / distinguished /
  research in candidate or job titles, or publication/patent markers in
  `candidate_profile_json` (keys or text: publications, patents).

YoE fallback parse: collect 4-digit years from free-form work-history
start/end strings; "present"/"current" → the current year; yoe = max − min,
conservative (months ignored). No parseable year → unknown. `now` is
injectable for tests.

**RenderingRecommendation** (Pydantic, added to `DraftCvOutput`):
`recommended_page_count: int (ge=1, le=3, default 1)`, `page_count_reason:
str`, `font_profile: 'modern_latex' | 'ats_clean' | 'classic_latex'`
(default `modern_latex`), `layout_density: 'compact' | 'standard' |
'spacious'` (default `standard`), `compression_strategy: list[str]`
(display-only rationale).

## Application Flow

`DraftCvWorkflow` changes only — no new workflow, no new endpoints:

1. `load_input()` additionally reads `years_of_experience` from the profile
   row it already fetches, computes `PagePolicy` via
   `compute_page_policy(...)`, and stashes it on `DraftCvInput`.
2. `build_prompt()` appends a Rendering Recommendation section: the policy
   (target/max + basis), the allowed enum values, and the instruction to word
   bullets to fit the target (generation-time wording-to-fit — export never
   rewrites text, decision 0014 §3).
3. `postprocess()` after `run_guards`: clamp
   `output.rendering_recommendation.recommended_page_count` into
   `[1, policy.max_pages]`; append `policy_clamped` quality note when the
   value moved; append policy notes (`yoe_unknown`). Clamping happens after
   the guards because `run_guards` replaces `quality_notes` wholesale.
4. `deterministic_fallback()` → `build_draft_cv(..., page_policy=policy)`
   emits the policy target, a server-templated reason, `modern_latex`, and
   density `compact` when target is 1 else `standard`, empty strategy list.
5. `persist()` builds `rendering_json` and passes it to `insert_draft_cv`.

`rendering_json` stored shape (renderers in US-044/045 read `recommendation`;
the policy snapshot makes override validation and the UI self-contained):

```json
{
  "recommendation": {
    "recommended_page_count": 1,
    "page_count_reason": "…",
    "font_profile": "modern_latex",
    "layout_density": "compact",
    "compression_strategy": ["…"]
  },
  "page_policy": {
    "target_pages": 1, "max_pages": 2,
    "yoe": 4.0, "yoe_source": "profile", "basis": "…",
    "seniority_signal": null, "exceptional": false,
    "evidence_volume": 11
  },
  "model_recommendation": {
    "recommended_page_count": 3,
    "font_profile": "modern_latex",
    "layout_density": "compact"
  }
}
```

`model_recommendation` keeps the pre-clamp values for audit. `cv_json` is
untouched (content-only contract; `assign_bullet_ids` continues to strip
non-content).

## Interface Contract

No new routes. Changed payloads:

- Generation envelope `result` now contains `rendering_recommendation`
  (validated output).
- `GET /api/matches/{id}/draft-cv`, `GET /api/draft-cvs/{id}`: rows include
  `rendering_json` (added to `_DRAFT_CV_SELECT`; version-list select stays
  slim).

## Data Model

Migration `0019_period10_rendering_json.sql` (additive, no backfill):

```sql
alter table public.draft_cvs
  add column if not exists rendering_json jsonb;
```

Pre-0019 rows render with legacy defaults downstream (US-044/045); the UI
offers "regenerate for a recommendation" (US-046).

## UI / Platform Impact

None in this story (US-046 owns the panel).

## Observability

Unchanged run/activity/log contract. The output snapshot on the run row now
includes `rendering_recommendation`; `policy_clamped` / `yoe_unknown` surface
through the existing quality-notes panel. No prompt/resume text in logs
(foundation rule).

## Alternatives Considered

1. Model-owned page count (brief literal) — rejected, decision 0014 §1.
2. Recommendation inside `cv_json` — rejected, 0014 alternatives §5.
3. Forcing a required seniority/job-structured input — rejected; optional
   enrichment, same stance as Period 9 restatement #10.
4. Backfill migration for old rows — rejected; recommendations derive from
   generation-time inputs we no longer have; regeneration is the honest path.
