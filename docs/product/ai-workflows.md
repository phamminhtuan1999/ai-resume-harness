# ApplyWise AI Workflows

## Reliability Rules

- Save canonical resume content and raw job description input before AI
  processing.
- For file-based resumes, convert the uploaded file to canonical Markdown/text
  before downstream parsing.
- Validate every AI response with a schema.
- Retry once when structured JSON output is invalid.
- Show a clear error and retry action when generation fails.
- Do not delete canonical resume content or raw job input when parsing or
  generation fails.
- Do not invent resume facts, skills, projects, titles, certifications, or
  experience.

## Privacy Rules

- Resume files, resume text, and job description text are sensitive.
- Production logs must not include uploaded resume files, canonical resume
  content, or raw job description content.
- AI prompts should include only the minimum user data needed for the requested
  workflow.

## AI Workflow Foundation

Every AI feature runs in the FastAPI backend on one shared flow (US-027,
realized; see `docs/decisions/0012-ai-workflow-standards.md`):

```text
authorize (enforce ownership) -> insert ai_workflow_runs row (queued -> running)
-> load minimum input -> build prompt with the standard preamble
-> call provider (Gemini; retry once on invalid JSON) OR deterministic fallback
-> validate output with Pydantic -> recompute/postprocess -> map confidence to status
-> persist domain result + output snapshot -> update run -> write activity_feed event
-> return the standard envelope
```

Provider rule: real Gemini is primary when `gemini_api_key` is configured; the
deterministic generators are the typed fallback used when no key is set or after
a terminal provider failure. Fallback output must satisfy the same schema, so
local/dev and provider-outage paths never regress shipped behavior.

Standard prompt preamble (every prompt begins with it): role (ApplyWise AI job
hunting assistant), source-of-truth (only the provided profile/resume/job),
truthfulness (invent nothing), output (valid JSON matching the schema), tone.

Standard success envelope (reused by every Period 8 endpoint):

```json
{ "workflow_run": { "id", "workflow_type", "status", "model_provider", "model_name", "latency_ms", "confidence_score", "error_message" }, "result": { } }
```

Error envelope and codes: `{ "error": { "code", "message", "retryable" } }` with
codes `unauthorized`, `missing_profile`, `missing_job_requirements`,
`invalid_json`, `schema_validation_failure`, `low_confidence`, `model_timeout`,
`provider_rate_limit`, `network_failure`. Failed runs still write the run row and
an activity event; no partial domain result is written on failure.

Confidence below 0.5 marks the run `needs_review` (the result is still
persisted). Each run writes one redacted JSON log line; no resume/JD text, prompt
bodies, or provider payloads appear in logs.

## Resume Import Normalization

Input:

- pasted Markdown or plain text
- uploaded PDF
- uploaded DOCX
- uploaded image file

Tooling:

- Use Docling in the Python backend to normalize supported resume inputs.
- Export normalized resume content as Markdown/text for storage in `raw_text`.
- Store Docling JSON output when useful for debugging parser quality, but do
  not expose raw implementation details to the user interface by default.

Rules:

- Text and Markdown inputs do not require Docling unless the backend chooses to
  normalize formatting.
- PDF, DOCX, and image imports should be processed by Docling before the resume
  parser runs.
- OCR should be enabled for scanned PDFs and image resumes.
- Unsupported file types must be rejected before processing.
- Import failures must show a clear error and must not create a misleading
  parsed resume.
- Original uploaded file retention is optional. If retained, files must be
  stored privately and remain deletable by the user.

## Resume Parser

Input:

- canonical `raw_resume_text` from pasted text/Markdown or Docling import

Output:

- `name` when available
- `current_title` when available
- `skills`
- `experience`
- `projects`
- `education`
- `certifications`

Rule:

- Extract only what is present in the canonical resume content. Do not infer
  missing skills.

## Job Description Parser

Input:

- `raw_job_description`

Output:

- `required_skills`
- `preferred_skills`
- `responsibilities`
- `seniority`
- `years_required`
- `ai_requirements`
- `cloud_requirements`
- `domain`
- `work_type`

## Job URL Fetcher And Extractor

Input:

- user-submitted job URL

Provider order:

1. Firecrawl scrape URL.
2. Manual paste fallback when fetch fails.
3. Browserbase only for future agentic browsing workflows.
4. Apify actors, job APIs, and approved feeds only for future discovery.

Output:

- source URL
- company
- title
- location
- work type
- employment type
- salary range when present
- responsibilities
- required skills
- preferred skills
- required experience years
- AI-related requirements
- cloud requirements
- raw job description
- confidence score

Rules:

- Validate the submitted URL before fetching.
- Normalize URLs before duplicate checks.
- Do not create a duplicate job when the normalized URL already exists for the
  same user.
- Validate every provider and AI extraction response with a strict schema.
- Save fetched jobs with source `manual_url`.
- If fetch fails, show a fallback path for manual job description paste.
- Do not rely on unauthorized LinkedIn scraping as the primary product path.
  LinkedIn URLs are supported only when user-submitted pages are accessible to
  the approved fetch provider.

## Candidate Profile Extractor

Input:

- canonical resume text already extracted by resume import normalization

Output:

- basic info
- professional summary
- categorized skills
- work experience
- projects
- education
- certifications
- AI-derived metadata
- confidence details and low-confidence fields

Rules:

- Use canonical resume text as the source of truth.
- Return structured JSON only.
- Do not invent companies, dates, skills, projects, metrics, education, or
  certifications.
- Missing values must be `null` or empty arrays.
- Preserve original resume bullet meaning.
- Separate work experience from projects when possible.
- Mark uncertain fields with low confidence instead of guessing.
- The user must review and edit the profile draft before it becomes the active
  candidate profile.

## Match Analyzer

Runs on the AI Workflow Foundation (US-028, realized). Gemini generates
evidence-based analysis; the deterministic baseline analyzer is the typed
fallback. Regenerate creates a new run and overwrites the saved analysis.

Input:

- candidate profile
- canonical resume text (and parsed resume when present)
- job requirements + raw job description
- user preferences (target role, location)

Output (validated `MatchAnalysisOutput`):

- `overall_score` (recomputed server-side from the weighting below; the model's
  value is advisory)
- `skill_score`, `experience_score`, `ai_readiness_score`, `ats_keyword_score`,
  `seniority_score`, `location_score`
- `seniority_match_label`
- `apply_recommendation` — `apply_now | apply_with_improvements | improve_first | not_recommended` (derived from the reconciled score band)
- `assistant_summary`, `fit_reasoning`
- `score_explanations` — one short line per score
- `top_strengths` — each with `resume_evidence`, `job_requirement`,
  `why_it_matters`; a strength with no `resume_evidence` is dropped
- `top_gaps` — each typed `true_gap | wording_gap | proof_gap`
- `risks`, `next_best_action`
- `confidence_score`

Score formula:

```text
overall_score =
  skill_score * 0.30 +
  experience_score * 0.20 +
  ai_readiness_score * 0.25 +
  ats_keyword_score * 0.15 +
  seniority_score * 0.10
```

Score categories:

| Score | Meaning |
| --- | --- |
| 90-100 | Strong match |
| 75-89 | Good match |
| 60-74 | Possible match with gaps |
| 40-59 | Weak match |
| 0-39 | Not recommended yet |

Deduplication and freshness:

- There is **one analysis per `(user, resume, job)`** (unique index; see
  `data-model.md`). Generating an analysis for a resume/job pair that was already
  analyzed opens the existing report instead of creating a duplicate — the user
  regenerates from there for a fresh run.
- The match records `analyzed_at`. When the resume or job is edited afterwards
  (its `updated_at` moves past `analyzed_at`), the analysis is **stale**: the UI
  flags it "Out of date" and offers regenerate. Analyses are never
  auto-regenerated (cost), and stale results are never shown as current. This is
  timestamp-based (Option A); a content hash would avoid flagging edits that do
  not change the analyzed text.

## Missing Skill Analysis

Missing skills are grouped as:

- Critical
- Medium
- Nice-to-have

Each gap includes:

- skill name
- why it matters
- whether it is missing completely or weakly shown
- suggested action

Gap types:

- True Gap: the resume has no evidence of the skill.
- Wording Gap: related experience may exist, but the resume does not
  communicate it clearly.
- Proof Gap: the resume claims the skill but lacks strong project or work
  evidence.

## Decision Engine & Analysis Package (Period 11, US-047)

A deterministic, server-side decision engine converts the saved module outputs
into one user-facing verdict per match. It is pure code — AI text is *input*,
never the verdict (decision 0015 §1). The engine and its rule constants live in
one place (`apps/api/app/services/decision_engine.py`) so they are testable as a
unit (maintainability NFR).

**Labels:** `strong_apply | apply_with_improvements | learning_target |
not_recommended` (display: "Strong Apply Target", "Apply With Improvements",
"Learning Target", "Not Recommended Yet").

**Ordered rules, first match wins** (band constants 80/60/35):

1. Unsafe-to-claim guard → Not Recommended: resume tailoring is known-unsafe, or
   a critical required skill has no evidence at high application risk. (Beats
   score.)
2. Score < 35 → Not Recommended.
3. Score 35–59 → Learning Target if the role is directionally relevant, else Not
   Recommended (a critical gap is named but does not change the band's label).
4. Score ≥ 60 with a critical gap → Apply With Improvements: the missing skill is
   named and material generation is capped at "allowed with a warning" (score
   wins at 60+ — name the gap and warn, do not gatekeep).
5. Score ≥ 80, no critical or important gaps, risk low/medium, tailoring not
   unsafe → Strong Apply.
6. Otherwise (≥ 60) → Apply With Improvements; a gap-free high-risk firing
   carries a risk-based reason, never gap copy.

**Absent inputs are the common case** (a fresh analysis has no resume-suggestions
or insight row) and are part of the contract: tailoring is tri-state
(`safe | unsafe | unknown`; only known-unsafe blocks a label), risk defaults to
`medium`, and decision confidence is the mean of the available core-module
confidences.

**Confidence** is shown qualitatively in the header (the numeric percentage
lives only in the Advanced surface). Reason codes: incomplete profile, no target
role, short/unextracted job description, ambiguous requirements,
deterministic-fallback provider, failed/partial/missing modules.

**Directional relevance** (gates Learning Target vs Not Recommended for weak
scores) is decided by an explicit role-family heuristic: a user's explicit
learning-target save always counts as relevant; otherwise role-family overlap
between the job title and the profile's target role (falling back to current
role); a learnable-gap lean is the last signal. No target role set → not
relevant, surfaced as the "set your target role" prompt.

**Analysis package.** `GET /api/matches/{match_id}/analysis-package` composes the
saved module rows (no AI calls) into one read model: job summary, the served
decision (label, match score, risk, qualitative confidence, summary, previous
decision), the score sub-breakdown, evidence, skill gaps, prioritized next
actions with material-readiness guardrails, and the analysis details. It serves
the latest decision snapshot and a staleness flag; it never writes. Staleness
trips when any input is newer than the snapshot — resume/job `updated_at` **and
`user_profiles.updated_at`**.

**Snapshots & recompute.** Snapshots are append-only and written **only** by
`recompute_decision`. Every flow that mutates a decision input ends with exactly
one recompute (analyze/regenerate, a per-step regenerate, an orchestrated run
once at the end), deduped by `inputs_hash`. An activity-feed entry is written
only on a genuine label transition. Module tables and endpoints remain the
source of record and the advanced/debug surface.

**Decision history (Period 11, US-054).**
`GET /api/matches/{id}/analysis-package/history` returns the append-only
snapshots newest-first, capped at 20 with the dropped count surfaced (no silent
cap). Each entry carries the label, score, risk, confidence, the previous label
(for a transition like "Not Recommended → Apply With Improvements"), the
`rules_version`, and a human summary of which input versions were used. The
history renders read-only inside the **Advanced** tab, with a "decision rules
updated" marker between adjacent snapshots whose `rules_version` differs — a
rule-tuning label change must never read as the user's fit changing.

**Refresh Analysis (Period 11, US-050).** The job analysis page exposes exactly
one re-run control. `POST /api/matches/{id}/analysis-package/refresh` re-runs
only the decision **core chain** — match analysis → missing skills → assistant
insight → decision recompute — never the four downstream artifacts (resume
draft, draft CV, cover letter, roadmap, interview prep), which regenerate only by
their own explicit actions (cost-control NFR). It is achieved by running the
orchestrator over a **core step-profile** rather than the full manifest. Job
requirement extraction is re-run conditionally before the chain (only when the
job isn't already extracted). Refresh is **asynchronous**: the endpoint returns
`202` and the client follows the existing run-status polling, refetching the
package on completion. A second refresh while one is in flight is rejected
**server-side with `409`** (checked against the running core-chain run). On any
core-step failure, **no decision snapshot is written** — the prior package
stands and the failure surfaces as a `module_failed` reason; history never
records a decision from mixed-generation inputs.

**Workflow panel visibility (Period 11, US-051).** The AI workflow panel (step
name, status, last run, provider, model, numeric confidence %, error detail,
per-step regenerate, stale markers) no longer renders on the main job-analysis
surface. It lives behind the **Advanced** tab
(`/matches/{id}/advanced`) — the renamed Analysis Details surface — collapsed
from the decision-first overview but keeping all its debugging value. Per-step
regenerate stays available there, and each regenerate is followed by exactly
one decision recompute so the visible label never diverges from the regenerated
module outputs. The decision history (US-054) renders in the same tab.

## Resume Suggestion Generator

Each suggestion includes:

- original text
- suggested text
- reason
- related job requirement
- evidence
- Truth Guard status

Truth Guard statuses:

- `Safe to use`: supported clearly by resume evidence.
- `Needs confirmation`: may be true but requires user confirmation.
- `Do not use yet`: adds experience not found in the resume.

Suggestions marked `Do not use yet` must not be automatically included in the
generated Tailored CV. (The standalone Markdown resume draft workflow,
US-032, was retired by US-059 / decision 0019 — Markdown is now an export
format of the Draft CV below.)

## Draft CV Generator (Period 9)

Runs on the AI Workflow Foundation (`workflow_type = 'draft_cv'`,
`subject_type = 'match'`; US-039). Direction:
`docs/decisions/0013-draft-cv-export-architecture.md`.

Input:

- match with a **saved match analysis (required)** — `missing_match_analysis`
  guard otherwise
- canonical resume text + parsed resume
- candidate profile (contact fields come only from here; null when absent)
- job raw description + structured/extraction keywords
- missing-skill analysis (**optional** enrichment)
- accepted / `safe_to_use` resume suggestions (optional input)

Generation is **one structured call** whose prompt embeds the
Cross-Referencing & Enhancement Protocol (keyword extraction with
required/preferred priority, supported-only keyword injection, XYZ bullet
rewriting, metrics preservation, truth-guard classification, ≤ 2-line
bullets). The protocol's guarantees are then enforced by deterministic server
guards after Pydantic validation:

- **Metrics guard (hard):** a numeric token in an output bullet that does not
  occur in the source corpus demotes the bullet to `do_not_use_yet`
  (`invented_metric` note). Source metrics missing from the output produce
  `metric_dropped` notes. No invented numbers can reach an export.
- **Keyword-support guard (hard):** skills/keywords with no occurrence in the
  source corpus move to `keywords_excluded(reason='unsupported')`.
- **XYZ/ATS lint (soft):** action-verb start (curated lexicon) and length;
  violations become quality notes and can mark the run `needs_review`.

Every bullet carries a server-assigned stable `id`, `source_evidence`,
`truth_guard_status` (`safe_to_use | needs_confirmation | do_not_use_yet`),
`keywords_used`, and `user_action` (`pending | approved | rejected`). Output
versions are append-only in `draft_cvs`; regenerate creates a new version and
approvals do not carry over.

Deterministic fallback: builds the CV mechanically from the candidate
profile, parsed resume sections, job keywords, and accepted suggestions —
copying source text **verbatim** (verbatim ⇒ `safe_to_use` by construction),
`confidence_score = 0.0`.

### Rendering Recommendation & Page Policy (Period 10, US-043)

Direction: `docs/decisions/0014-draft-cv-rendering-rework.md` §1/§6.

- Before the prompt, the server computes a **deterministic page policy** from
  `user_profiles.years_of_experience` (fallback: conservative span-parse of
  profile work-history dates; else default band target 1 / max 2 +
  `yoe_unknown` note). Bands: 0–2 y → 1/1; 3–7 y → 1, with 2 allowed at ≥ 5 y
  or on the evidence-volume trigger; 8–12 y → 1–2, preferring 2 on
  senior/staff signals; 12+ y → 2, with 3 allowed only behind the exceptional
  gate (principal/staff/distinguished/research titles or publication/patent
  markers — mechanical proxies, never the model's say-so). Job seniority is
  optional enrichment.
- The prompt states the policy and target so the model **words bullets to
  fit** (wording-to-fit is generation-time only; export never rewrites text).
- The model output gains `rendering_recommendation` (`recommended_page_count`,
  `page_count_reason`, `font_profile`, `layout_density`,
  `compression_strategy[]` rationale). The server **clamps** the page count
  into the policy's allowed range (`policy_clamped` quality note on
  disagreement); reason/density/strategy are display-only.
- Stored in `draft_cvs.rendering_json` (clamped recommendation + policy
  snapshot + pre-clamp model values). The fallback emits the policy target
  with a templated reason and `modern_latex`.

## Draft CV Export Rules (Period 9)

Export (US-041 PDF, US-042 DOCX, US-059 Markdown) is **not an AI run** — no
model call, no `ai_workflow_runs` row; it writes a `draft_cv.exported`
activity event.

- One shared render-model serializer is the only path from `cv_json` to any
  visible document (web preview, PDF, DOCX, Markdown). A bullet renders iff
  `safe_to_use` OR approved `needs_confirmation`. `do_not_use_yet` and
  pending/rejected items never render — server-side filtering is
  authoritative; the UI warning dialog is courtesy.
- Markdown has no pagination: it always renders the full gated model (page
  targeting and font profiles apply to PDF/DOCX only) and stamps no
  per-format timestamp column.
- Files render on demand from the stored version and stream as downloads;
  no rendered binary is persisted ("download again later" = deterministic
  re-render).
- Template contract ("ApplyWise standard resume template v1"): single column,
  standard section headings, no tables/charts/icons/progress bars/images,
  plain bullets ≤ 2 printed lines, consistent spacing, ATS-parseable
  (copy-paste preserves reading order).
- `export_notes` (included supported keywords, excluded unsupported keywords,
  items needing review, metrics preserved) are computed server-side at export
  time, never model-authored.
- Export with zero renderable content fails with `empty_cv`. Render failures
  mutate nothing.
- Export logs carry draft id/format/latency only — never candidate or CV
  text.

### Rendering Rework (Period 10, US-044/US-045)

Direction: `docs/decisions/0014-draft-cv-rendering-rework.md` §2–§5.

- **Font profiles** (`rendering_json.recommendation.font_profile`; default
  `modern_latex`): PDF embeds vendored libre TTFs (subsetted) —
  `modern_latex` → CMU Serif, `ats_clean` → Liberation Sans, `classic_latex`
  → Liberation Serif. The embedded path is full Unicode (real `•`/`–`/`—`,
  diacritics). DOCX names exactly one universal font per profile
  (Times New Roman / Arial / Times New Roman) — OOXML has no fallback chain
  and python-docx cannot embed. A missing/corrupt font asset falls back to
  core fonts + ASCII transliteration with a visible note; a font problem
  never fails an export.
- **Page-aware layout**: a typed `RenderConfig` keyed by (page target,
  density) — margins, pt sizes (name 18 / heading 12 / body 10 / metadata 9),
  line factors, per-entry bullet caps, project limit, summary cap. The
  240-char bullet cap stays.
- **Compression is selection-only, ordered, deterministic**, inside the
  shared render-model build: progressive levels (per-entry caps → older-entry
  detail → project limit + skill dedupe → summary sentence-boundary
  truncation). It can only remove renderable content — never rewrite or add.
  A **protected floor** (bullets with impact metrics or prioritized-keyword
  evidence) is never dropped; if the floor alone overflows the target, export
  proceeds with a `page_overflow` note. Page count is enforced by a bounded
  measure loop on the PDF (render → count → next level); DOCX receives the
  identical compressed model (content parity guaranteed, page parity
  best-effort).
- Every compression run produces a **machine-readable report** (steps,
  every dropped item, measured pages, overflow) returned by
  `export-preview` — never silently shrink a user-approved CV.
- **User override**: `?pages=N` on export/export-preview, validated against
  the stored policy range (`invalid_page_override` otherwise); below the
  recommendation the server computes warning copy. Overrides are render
  parameters — never stored, never a new version. Legacy rows (null
  `rendering_json`) render with Period 9 behavior and reject `pages` with
  `no_rendering_recommendation`.

## Roadmap Generator

Input:

- missing skills
- target role
- current resume

Output:

- exactly 4 weeks

Each week includes:

- goal
- skills covered
- tasks
- deliverables
- suggested project work
- resume bullet after completion

Critical missing skills should be prioritized first.

## Interview Prep Generator

Input:

- resume
- job
- missing skills
- match analysis

Output:

- likely technical questions
- likely AI/LLM questions
- likely system design questions
- likely behavioral questions
- weak topics to study
- suggested answer framing based on resume evidence

When the user lacks evidence for a topic, the prep should say the user needs to
study or build proof instead of pretending they already have experience.
