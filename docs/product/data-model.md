# ApplyWise Data Model

## Ownership Rule

Every user-owned record belongs to an app-level `user_profiles` row that maps
to Clerk's `clerk_user_id`. API handlers must enforce ownership on reads,
writes, updates, deletes, and generated analysis access.

## Tables

### `user_profiles`

Stores app-level profile data for a Clerk user.

Required fields:

- `id uuid primary key`
- `clerk_user_id text not null unique`
- `email text not null`
- `full_name text`
- `current_role text`
- `years_of_experience numeric`
- `target_role text`
- `location_city text`
- `location_country text` — ISO 3166 alpha-2 code
- `location_preference text` — derived "City, Country" display string
- `contact_email text`, `phone text` — user-edited CV contact overrides
- `technical_background text`
- `candidate_profile_json jsonb`
- `candidate_profile_confidence_json jsonb`
- `profile_source text default 'manual'`
- `profile_source_resume_id uuid references resumes(id) on delete set null`
- timestamps

`candidate_profile_json` stores the reviewed structured candidate profile after
resume-based profile import. Summary columns such as `current_role`,
`years_of_experience`, `target_role`, `location_preference`, and
`technical_background` remain the lightweight fields used by existing MVP
screens.

Location is captured structurally (US-057, decision 0017): `location_country`
(ISO alpha-2, chosen from a list) and a free-text `location_city`.
`location_preference` is derived from them as "City, Country" on save and stays
the column the generated CV and profile display read. `phone` is validated
against `location_country` and stored normalized to E.164; `contact_email` and
`phone` override the resume-imported contact on generated CVs. Cleared fields
persist `NULL`.

Valid `profile_source` values:

- `manual`
- `resume_import`

### `resumes`

Stores canonical resume content and optional structured parser output.

Resume content can come from pasted Markdown/plain text or an imported PDF,
DOCX, or image file. Imported files are normalized through Docling into
canonical Markdown/text before downstream resume parsing.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `title text not null`
- `raw_text text not null`
- `source_type text not null default 'text'`
- `source_file_name text`
- `source_mime_type text`
- `source_size_bytes integer`
- `source_storage_path text`
- `docling_json jsonb`
- `import_status text default 'not_required'`
- `import_error text`
- `structured_json jsonb`
- `is_primary boolean default false`
- `parse_status text default 'not_parsed'`
- timestamps

Valid `source_type` values:

- `text`
- `markdown`
- `pdf`
- `docx`
- `image`

Valid `import_status` values:

- `not_required`
- `pending`
- `processing`
- `succeeded`
- `failed`

`raw_text` remains the canonical resume content used by the AI parser. For file
imports, `raw_text` stores Docling's Markdown/text output, not binary file
content.

### `jobs`

Stores manually entered job metadata, URL-imported job metadata, raw job
description text, parser output, and optional contact details.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `company text not null`
- `title text not null`
- `source text default 'manual'`
- `job_url text`
- `normalized_url text`
- `location text`
- `work_type text`
- `employment_type text`
- `salary_range text`
- `raw_description text not null`
- `structured_json jsonb`
- `parse_status text default 'not_parsed'`
- `extraction_status text default 'not_required'`
- `extraction_confidence numeric`
- `extraction_json jsonb`
- `contact_name text`
- `contact_email text`
- `contact_linkedin_url text`
- `contact_notes text`
- timestamps

Valid `source` values:

- `manual`
- `manual_url`

Valid `extraction_status` values:

- `not_required`
- `pending`
- `processing`
- `succeeded`
- `failed`

For URL-imported jobs, `normalized_url` should be unique per user when present.
The app should not create a duplicate job for the same user and normalized URL.

### `matches`

Stores resume-to-job scoring and analysis output.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `resume_id uuid references resumes(id) on delete cascade`
- `job_id uuid references jobs(id) on delete cascade`
- `overall_score int`
- `skill_score int`
- `experience_score int`
- `ai_readiness_score int`
- `ats_keyword_score int`
- `seniority_score int`
- `strengths_json jsonb`
- `weaknesses_json jsonb`
- `missing_skills_json jsonb`
- `risks_json jsonb`
- `explanation_json jsonb`
- timestamps

Period 8 AI analysis columns (additive, migration `0011`; US-028). The existing
columns above are preserved and kept in sync for backward compatibility:

- `apply_recommendation text` — `apply_now | apply_with_improvements | improve_first | not_recommended`
- `assistant_summary text`
- `fit_reasoning text`
- `score_explanations_json jsonb`
- `top_strengths_json jsonb` — evidence-linked; a strength with no `resume_evidence` is dropped
- `top_gaps_json jsonb` — each gap typed `true_gap | wording_gap | proof_gap`
- `next_best_action text`
- `seniority_match_label text`
- `location_score int`
- `confidence_score numeric`
- `analyzer_provider text` — `gemini | deterministic`

`overall_score` is always recomputed server-side from the accepted weighting
(`skill*0.30 + experience*0.20 + ai_readiness*0.25 + ats_keyword*0.15 +
seniority*0.10`); the model's `overall_score` is advisory only.

Dedup + freshness columns (migration `0015`):

- `analyzed_at timestamptz` — when the AI analysis was generated. Set by
  `save_match_analysis`. A match is **stale** when its resume or job
  `updated_at` is later than `analyzed_at` (timestamp-based freshness, Option A).
  The UI shows an "Out of date" affordance and offers regenerate; matches are
  never auto-regenerated.

There is **one analysis per `(user_id, resume_id, job_id)`**, enforced by a
unique index `matches_user_resume_job_uniq (user_id, resume_id, job_id)`. The web
generate flow pre-checks for an existing match (redirecting to it) and also
handles the unique-violation race by redirecting to the existing report.

### `ai_workflow_runs`

The audit/observability record for every AI feature (Period 8, migration `0010`;
US-027). One row per execution of one workflow for one subject.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `workflow_type text` — `match_analysis | missing_skills | resume_suggestions | resume_draft | cover_letter | roadmap | interview_prep | assistant_insight | dashboard_summary | activity_description | draft_cv`

`draft_cv` is added by Period 9 (migration `0018`, US-039). The
`workflow_type` CHECK constraint from migration `0010` is extended in place
(per `docs/stories/period-8/flows/README.md`). `resume_draft` generation was
retired by US-059 / decision 0019; the value stays in the constraint and the
API schema so historic run rows keep validating.
- `subject_type text` — `match | resume | job | dashboard`
- `subject_id uuid` (nullable for dashboard-scoped runs)
- `status text default 'queued'` — `queued | running | completed | needs_review | failed`
- `model_provider text` — `gemini | deterministic`
- `model_name text`
- `started_at timestamptz`
- `completed_at timestamptz`
- `latency_ms int`
- `confidence_score numeric`
- `output_snapshot_json jsonb` — validated output for reuse without re-running
- `error_code text`
- `error_message text`
- timestamps

Index: `(user_id, subject_type, subject_id, workflow_type)`.

### `activity_feed`

The user-facing record that an AI step happened (Period 8, migration `0010`;
US-027). Distinct from `ai_workflow_runs` (the durable per-run record) and from
app logs.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `workflow_run_id uuid references ai_workflow_runs(id) on delete set null`
- `activity_type text` — workflow type + lifecycle (e.g. `match_analysis.completed`)
- `related_job_id uuid references jobs(id) on delete set null`
- `related_match_id uuid references matches(id) on delete set null`
- `title text`
- `assistant_description text` — short AI text; filled by US-037, deterministic fallback allowed
- `importance text default 'low'` — `low | medium | high`
- `created_at timestamptz`

Index: `(user_id, created_at desc)`.

### `missing_skill_analyses`

The AI missing-skill / gap analysis for a match (Period 8, migration `0012`;
US-029). One row per match (upserted on regenerate).

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid not null unique references matches(id) on delete cascade`
- `summary text`
- `missing_skills_json jsonb` — each gap: skill, importance
  (`critical | medium | nice_to_have`), gap_type
  (`true_gap | wording_gap | proof_gap`), evidence_status
  (`no_evidence | weak_evidence | strong_evidence`), resume_evidence, fix,
  suggested project task, interview risk
- `top_3_priority_gaps_json jsonb`
- `confidence_score numeric`
- `provider text` — `gemini | deterministic`
- timestamps

### `assistant_insights`

The decision-oriented job assistant insight for a match (Period 8, migration
`0013`; US-030). One row per match (upserted on regenerate). The
`recommendation`, `risk_level`, and routed `next_best_action` are derived
server-side from the saved match analysis so the card can never contradict the
score.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid not null unique references matches(id) on delete cascade`
- `assistant_summary text`
- `recommendation text` — `apply_now | tailor_resume_first | build_project_first | low_priority`
- `why_this_recommendation text`
- `next_best_action text`
- `application_strategy text`
- `risk_level text` — `low | medium | high`
- `confidence_score numeric`
- `provider text` — `gemini | deterministic`
- timestamps

### `cover_letters`

The AI-generated cover letter for a match (Period 8, migration `0014`; US-033).
One row per match (upserted on regenerate).

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid not null unique references matches(id) on delete cascade`
- `job_id uuid references jobs(id) on delete set null`
- `cover_letter text`
- `cover_letter_strategy text`
- `key_points_json jsonb`
- `claims_avoided_json jsonb`
- `tone text` — `professional | concise | enthusiastic`
- `confidence_score numeric`
- `provider text` — `gemini | deterministic`
- `source_draft_cv_id uuid references draft_cvs(id) on delete set null`,
  `source_draft_cv_version integer` — US-063 (migration `0025`): the Tailored
  CV version the letter was written from; powers the staleness hint.
- timestamps

### `draft_cvs`

The structured, truth-guarded, exportable draft CV versions for a match
(Period 9, migration `0018`; US-039). **Append-only versions** per match —
generate/regenerate inserts a new version; review actions update that version
in place. See `docs/decisions/0013-draft-cv-export-architecture.md`.

Required fields:

- `id uuid primary key`
- `user_id uuid not null references user_profiles(id) on delete cascade`
- `match_id uuid not null references matches(id) on delete cascade`
- `job_id uuid references jobs(id) on delete set null` — denormalized for
  per-job listing; lifecycle governed by the match cascade
- `resume_id uuid references resumes(id) on delete set null`
- `version integer not null` — `unique (match_id, version)`
- `title text not null` — auto `Draft CV — {company} {job title} v{n}`
- `status text not null default 'draft'` —
  `draft | needs_review | ready_to_export | exported`; **derived server-side**
  (`needs_review` while `needs_confirmation` bullets are pending or run
  confidence `< 0.5`; `ready_to_export` when none pending; `exported` after a
  successful export). There is no `failed` status — failed generations write
  only the `ai_workflow_runs` row.
- `cv_json jsonb not null` — candidate contact (null when absent, never
  invented), professional summary, skills `[{category, items}]` (open
  vocabulary, empty categories omitted), work experience / projects /
  education / certifications. Every experience/project bullet carries:
  server-assigned stable `id`, `text` (≤ 240 chars), `source_evidence`,
  `truth_guard_status` (`safe_to_use | needs_confirmation | do_not_use_yet`,
  stored snake_case — unlike `resume_suggestions`, which stores title-case
  display values), `keywords_used`, `user_action`
  (`pending | approved | rejected`; approvals do not carry across versions),
  and `source_feedback_id` (US-061, additive JSON — the `resume_suggestions.id`
  the bullet was produced from, or null; server-sanitized against the feedback
  ids that were actually in the prompt). Tier-2 edits (US-060, additive JSON)
  add per-bullet `user_edited`, `polished`, `original_text` (single-level
  revert), `finalized_at` (a finalized bullet is stable — never re-polished —
  and survives regeneration), `evidence_question`, and a transient
  `pending_edit {user_text, polished_text, truth_guard_status,
  evidence_question}` staged between the polish+verify pass and the user's
  diff confirm (render gating ignores it). A regeneration that restructures a
  finalized bullet's entry stores `preservation_conflicts
  [{section, entry, bullet}]` at the cv_json root for per-bullet keep/take
  resolution — never a silent loss.
- `cv_strategy_json jsonb` — summary, primary positioning,
  `keywords_prioritized`, `keywords_excluded [{keyword, reason:
  unsupported | weak_evidence | irrelevant}]`
- `quality_notes_json jsonb` — server guard findings (`invented_metric`,
  `metric_dropped`, `weak_action_verb`; Period 10 adds `policy_clamped`,
  `yoe_unknown`)
- `confidence_score numeric`
- `provider text` — `gemini | deterministic`
- `model_name text`
- `last_exported_pdf_at timestamptz`, `last_exported_docx_at timestamptz` —
  exports are rendered on demand and streamed; **no export URLs and no binary
  storage** (decision 0013)
- `rendering_json jsonb` (nullable; Period 10, migration `0019`, US-043) —
  rendering metadata, kept out of the content-only `cv_json`:
  `recommendation` (the **policy-clamped** `recommended_page_count`,
  `page_count_reason`, `font_profile`
  (`modern_latex | ats_clean | classic_latex`), `layout_density`
  (`compact | standard | spacious`), display-only `compression_strategy[]`),
  `page_policy` (server-computed snapshot: `target_pages`, `max_pages`,
  `yoe`, `yoe_source`, `basis`, `seniority_signal`, `exceptional`,
  `evidence_volume`), and `model_recommendation` (the model's pre-clamp
  values, for audit). Null on pre-0019 rows → renderers use legacy defaults
  and the UI offers regeneration. See
  `docs/decisions/0014-draft-cv-rendering-rework.md`.
- timestamps

Indexes: `(user_id, job_id, created_at desc)` for "saved under the job
record" listing; `(match_id, version desc)`.

### `resume_suggestions`

Stores generated resume suggestions and Truth Guard state.

Required fields:

- `id uuid primary key`
- `match_id uuid references matches(id) on delete cascade`
- `original_text text`
- `suggested_text text not null`
- `suggestion_type text`
- `related_job_requirement text`
- `evidence text`
- `truth_guard_status text not null`
- `reason text`
- `user_action text default 'pending'`
- `user_edited boolean not null default false` — US-061 (migration `0024`):
  true once the user saves edited text with an Accept. User-edited feedback is
  authoritative information for Draft CV generation (decision 0019).
- timestamps

Valid `truth_guard_status` values:

- `Safe to use`
- `Needs confirmation`
- `Do not use yet`

Refresh semantics (US-061): regenerating suggestions deletes and replaces only
`pending` rows. Accepted/rejected rows survive, and an incoming suggestion
whose text duplicates a surviving row is dropped — tier-1 responses are the
user's curation work and are never silently reset.

### `resume_versions`

Stores generated Markdown resume drafts. **Dormant since US-059 / decision
0019** — the generator (`ResumeDraftWorkflow`, US-032) was retired, so the
table gains no new rows; existing rows are untouched and a drop migration is
deferred to a later cleanup.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `resume_id uuid references resumes(id) on delete cascade`
- `job_id uuid references jobs(id) on delete cascade`
- `match_id uuid references matches(id) on delete cascade`
- `title text not null`
- `content_markdown text not null`
- timestamps

### `roadmaps`

Stores the generated 4-week improvement roadmap for a match.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid references matches(id) on delete cascade`
- `title text not null`
- `roadmap_json jsonb not null`
- timestamps

### `interview_preps`

Stores generated interview preparation output for a match.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid references matches(id) on delete cascade`
- `questions_json jsonb`
- `weak_topics_json jsonb`
- `study_plan_json jsonb`
- `answer_guidance_json jsonb`
- timestamps

### `applications`

Stores tracker state for saved jobs and applications.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `job_id uuid references jobs(id) on delete cascade`
- `match_id uuid references matches(id) on delete set null`
- `status text not null default 'saved'`
- `applied_date date`
- `notes text`
- timestamps

Valid `status` storage values (decision 0009):

- `saved`
- `prepared` — US-038 (migration `0017`): set when run-full completes all AI steps.
- `applied`
- `interviewing`
- `offer`
- `rejected`
- `archived`
- `learning_target` — US-052 (migration `0021`): a role the user is building
  skills toward.

The browser UI displays these as `Saved`, `Prepared`, `Applied`,
`Interviewing`, `Offer`, `Rejected`, `Archived`, and `Learning Target`.

Status groups (US-052): **pipeline** (`saved`, `prepared`, `applied`,
`interviewing`, `offer`) are the *active applications*; **closed** (`rejected`,
`archived`); **learning** (`learning_target`) is tracked but never counted as an
active application and renders in its own tracker segment. A `learning_target`
may only transition to `saved`, `applied`, or `archived`.

### `analysis_decisions` (Period 11, US-047)

Append-only decision snapshots: one row per recompute, never updated or deleted.
Written **only** by the server-side `recompute_decision`; the
`GET /api/matches/{match_id}/analysis-package` read path never writes (decision
0015 §7). Each row records the server-computed verdict and the inputs that
produced it, so history (US-054) can show how a decision evolved and whether a
change was caused by the user or by rule tuning.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid references matches(id) on delete cascade`
- `label text not null` — `strong_apply | apply_with_improvements |
  learning_target | not_recommended`
- `display_label text not null`
- `match_score numeric`
- `scores_json jsonb` — the sub-score breakdown at decision time
- `risk_level text` — `low | medium | high`
- `confidence numeric`, `confidence_reasons_json jsonb`
- `summary text`, `evidence_json jsonb`
- `inputs_snapshot_json jsonb` — module row ids + timestamps used
- `inputs_hash text not null` — module row ids + their `updated_at` +
  `rules_version`; the compare-before-insert identity that dedupes snapshots
- `rules_version text not null` — band constants are tunable; history
  distinguishes "the rules changed" from "you changed"
- `previous_label text`
- `decided_at timestamptz`, timestamps

Indexed `(user_id, match_id, decided_at desc)`. Cascade delete via user/match
is the privacy/GDPR deletion path — snapshot evidence text is resume-derived
PII. Retention policy: most recent 50 snapshots per match (enforcement may be
deferred; the policy may not).

## Deletion and Retention (Period 12, US-055/US-056, decision 0016)

Deletion is an immediate, permanent hard delete; the FK cascade graph above
is the mechanism and no `deleted_at` flags exist. Ownership is enforced in
the mutation: server actions run on the service-role client (RLS is
bypassed), so every delete statement is scoped by `id` **and** the caller's
`user_id`/`clerk_user_id` and verifies a row was removed before reporting
success.

- **Resume deletion** removes the row; its matches cascade, taking every
  match-scoped analysis with them. `draft_cvs.resume_id` and
  `user_profiles.profile_source_resume_id` null out.
- **Job deletion** removes the row; its matches cascade as above, and tracker
  `applications` rows die with the job. Feed references null out.
- **Account deletion** removes the `user_profiles` row (cascading every
  workspace table), then deletes the Clerk user, in that order — a Clerk
  failure after the purge is retriable; the reverse would strand orphaned
  PII. Requires typed `DELETE` confirmation.

Audit: resume/job deletion writes an `activity_feed` row (`resume.deleted` /
`job.deleted`, importance `high`) naming the record and its cascade counts,
inserted **before** the delete so an unaudited deletion cannot happen. Audit
rows are retained for the life of the account and purged with it — after
account deletion zero workspace rows remain.
