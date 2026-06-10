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

Suggestions marked `Do not use yet` must not be automatically included in a
generated Markdown draft.

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

Export (US-041 PDF, US-042 DOCX) is **not an AI run** — no model call, no
`ai_workflow_runs` row; it writes a `draft_cv.exported` activity event.

- One shared render-model serializer is the only path from `cv_json` to any
  visible document (web preview, PDF, DOCX). A bullet renders iff
  `safe_to_use` OR approved `needs_confirmation`. `do_not_use_yet` and
  pending/rejected items never render — server-side filtering is
  authoritative; the UI warning dialog is courtesy.
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
