# Design

## Domain Model

**DraftCv** — one generated, reviewable CV version for a match.
Value rules:

- A bullet is the atomic truth unit: `{ id, text, source_evidence,
  truth_guard_status, keywords_used, user_action }`. `id` is a server-assigned
  uuid4 (the model never produces ids). `truth_guard_status` ∈
  `safe_to_use | needs_confirmation | do_not_use_yet` (US-031 model enum,
  stored snake_case in `cv_json`). `user_action` ∈
  `pending | approved | rejected`, initialized `pending`, only meaningful when
  status is `needs_confirmation`.
- **Renderable** bullet := `safe_to_use` OR (`needs_confirmation` AND
  `user_action = 'approved'`). Export and preview filtering both derive from
  this single predicate (shared serializer, US-041).
- Draft `status` is derived, never user-set: `needs_review` when any
  `needs_confirmation` bullet has `user_action = 'pending'` OR run
  `confidence_score < 0.5`; else `ready_to_export`; `exported` once an export
  succeeds (US-041/042 set it). `draft` is only the column default before
  first derivation. No `failed` status (decision 0013 §4).
- Versions are append-only per match; `version` increments from the current
  max. Approvals never carry across versions.

## Application Flow

Command `GenerateDraftCv(match_id)` via `DraftCvWorkflow(BaseAIWorkflow)`,
`workflow_type = 'draft_cv'`, `subject_type = 'match'`:

1. `load_input()` — owned match + saved match analysis (**required**; error
   `missing_match_analysis` 422 when `analyzed_at` is null), resume
   (`raw_text` + `structured_json`), `candidate_profile_json` + contact
   columns from `user_profiles`, job (`raw_description`, `structured_json`,
   `extraction_json`), missing-skill analysis (**optional**),
   accepted/`safe_to_use` resume suggestions (**optional**).
2. `build_prompt()` — standard preamble + the Cross-Referencing & Enhancement
   Protocol (keyword extraction w/ required-vs-preferred, supported-only
   injection, XYZ rule, metrics preservation, truth-guard classification,
   ≤ 2-line bullets, contact fields null-when-absent, JSON only).
3. Provider: Gemini structured call, retry once on invalid JSON; terminal
   failure → deterministic fallback.
4. Validate `DraftCvOutput` (Pydantic).
5. `postprocess()` — the three guards, then id assignment, then status
   derivation:
   - **Metrics guard (hard):** numeric token = number, percent, currency, or
     magnitude phrase (`\$?\d[\d,.]*\s*(%|k|m|x|ms|s)?` class). Output-bullet
     tokens absent from source corpus (resume `raw_text` + profile json +
     accepted suggestions) → demote bullet to `do_not_use_yet`, quality note
     `invented_metric`. Source-bullet tokens absent from output → quality note
     `metric_dropped` (no demotion).
   - **Keyword-support guard (hard):** skill items and
     `keywords_prioritized` entries with no case-insensitive occurrence in
     the source corpus move to `keywords_excluded(reason='unsupported')` and
     are removed from `skills`/prioritized list.
   - **XYZ/ATS lint (soft):** first word in curated action-verb lexicon
     (`apps/api/app/services/ai/action_verbs.py`, ~200 verbs); violations →
     quality note `weak_action_verb`; > 2 lint notes → run demoted to
     `needs_review`. Length is enforced by schema (`max_length=240`).
6. `persist()` — insert `draft_cvs` version row; envelope returns
   `{ workflow_run, result: { draft_cv } }`.

Deterministic fallback: builds `DraftCvOutput` mechanically — contact from
profile columns, skills from `candidate_profile_json` categories intersected
with job `extraction_json` keywords, experience/projects/education copied
**verbatim** from `structured_json`/profile (verbatim ⇒ `safe_to_use` by
construction), strategy text templated from match analysis fields,
`confidence_score = 0.0`, provider `deterministic`.

Queries: `GetLatestDraftCv(match_id)` (latest row + version list metadata +
latest `draft_cv` run), `GetDraftCv(draft_cv_id)`.

## Interface Contract

- `POST /api/matches/{match_id}/draft-cv` — generate; 200 standard envelope.
- `POST /api/matches/{match_id}/draft-cv/regenerate` — new version row.
- `GET /api/matches/{match_id}/draft-cv` — `{ draft_cv | null, versions: [{id,
  version, status, created_at, provider, confidence_score}], workflow_run |
  null }`.
- `GET /api/draft-cvs/{draft_cv_id}` — one full row (ownership-checked).
- Errors: foundation taxonomy + `missing_match_analysis` (422). Ownership
  failure → `unauthorized`, no rows written. New routers:
  `apps/api/app/routers/draft_cvs.py` (+ match-scoped routes in
  `matches.py` or mounted router), wired in `main.py`.

## Data Model

Migration `0018_period9_draft_cvs.sql` (number TENTATIVE — next free at
implementation time):

```sql
create table public.draft_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  resume_id uuid references public.resumes(id) on delete set null,
  version integer not null,
  title text not null,
  status text not null default 'draft' check (status in
    ('draft','needs_review','ready_to_export','exported')),
  cv_json jsonb not null,
  cv_strategy_json jsonb,
  quality_notes_json jsonb,
  confidence_score numeric,
  provider text check (provider in ('gemini','deterministic')),
  model_name text,
  last_exported_pdf_at timestamptz,
  last_exported_docx_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, version)
);
create index draft_cvs_user_job_idx
  on public.draft_cvs (user_id, job_id, created_at desc);
create index draft_cvs_match_idx
  on public.draft_cvs (match_id, version desc);
```

Plus: drop + recreate the `ai_workflow_runs.workflow_type` CHECK including
`'draft_cv'`. `title` auto-generated: `Draft CV — {company} {job title} v{n}`.
`cv_json` is the brief's schema with bullet `id`/`user_action` added and
`export_notes` removed (computed at export, decision 0013 §2/§6). Retention:
rows die with the match (cascade); job/resume deletion nulls the denormalized
pointers while the match cascade governs lifecycle.

## UI / Platform Impact

None in this story (API-only). US-040 consumes the read endpoints.

## Observability

One `ai_workflow_runs` row per generation (`draft_cv`), output snapshot
persisted; `activity_feed` event `draft_cv.completed` / `draft_cv.needs_review`
(importance medium) with related match/job ids; one redacted JSON log line per
run — no resume text, JD text, CV content, or prompt bodies in logs
(foundation rule).

## Alternatives Considered

1. Chained per-protocol-stage model calls — rejected (decision 0013 §2).
2. Reuse `resume_versions` with extra jsonb columns — rejected (decision 0013
   alternatives §4).
3. Prompt-only enforcement of metrics/keyword/XYZ rules — rejected; the rules
   are mechanically checkable and a prompt cannot guarantee them.
4. Hard generation failure on invented metrics instead of demotion — kept as
   an open question in the period README; demotion preserves the rest of a
   good draft and surfaces the bad bullet for review.
