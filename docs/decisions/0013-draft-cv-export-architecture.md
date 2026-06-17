# 0013 Draft CV Export Architecture

Date: 2026-06-09

## Status

Accepted (amended 2026-06-09: PDF renderer switched WeasyPrint → fpdf2, the
pre-authorized fallback in §5/alternative 5 below — WeasyPrint's native
Pango/cairo libraries are not available in the target environment. The render
model remains the durable contract, so preview/PDF/DOCX stay identical and no
other part of this decision changes.)

## Context

The Period 9 brief asks for an AI Draft CV
feature: generate a job-tailored, truth-guarded CV as structured JSON, let the
user review/approve uncertain claims, and export PDF/DOCX in an ATS-safe
"ApplyWise standard resume template". The brief suggests job-scoped endpoints
(`/api/jobs/:jobId/draft-cv`), Puppeteer + the `docx` npm package + Zod for
rendering/validation, stored export URLs (`exported_pdf_url`/`exported_docx_url`),
and a `failed` draft status.

Four of those suggestions conflict with the system as built:

1. **Stack.** All AI generation runs in the FastAPI backend with Pydantic
   validation (decision `0012`); the web tier no longer generates or persists
   analysis. Puppeteer/Zod/docx-npm would re-split the AI surface across two
   stacks and add a headless-Chromium dependency.
2. **Anchoring.** Every AI artifact (analysis, suggestions, drafts, cover
   letters) hangs off a `matches` row (resume × job), not a job. A job can
   have multiple matches (one per resume), so "the job's draft CV" is
   ambiguous as a primary key. Decision `0012` already mapped a previous
   brief's `/jobs/:id/*` URLs onto `/matches/:id/*`.
3. **Storage.** ApplyWise currently stores **no binary files at all** (even
   imported resume files are normalized to text and discarded). Persisting
   exported PDFs/DOCX would introduce object storage, signed URLs, retention
   and deletion lifecycle for PII documents — a large new surface the brief
   does not actually need.
4. **Failure writes.** The US-027 foundation never persists a partial domain
   row on failure (the `ai_workflow_runs` row carries the failure), so a
   `failed` status on `draft_cvs` contradicts the established flow.

The brief also omits two things the foundation requires — a deterministic
fallback provider and an approval-state storage design for
`needs_confirmation` items — and specifies a five-stage AI pipeline that would
multiply latency, cost, and failure modes if implemented as chained model
calls.

## Decision

**1. Draft CVs are match-anchored and versioned.** New table `draft_cvs`:
`match_id` is `not null` with `on delete cascade` (like `cover_letters`);
`job_id` and `resume_id` are denormalized nullable `on delete set null`
pointers so "saved under the job record" stays queryable. Rows are
**append-only versions** per match (`unique (match_id, version)`), matching
the `resume_versions` precedent: generate/regenerate inserts a new version,
review actions update that version in place. Endpoints follow the match-scoped
convention: `POST/GET /api/matches/{match_id}/draft-cv`, plus
`GET /api/draft-cvs/{draft_cv_id}` and draft-scoped review/export routes. The
brief's `/jobs/:jobId/draft-cv` page maps to `/matches/[matchId]/draft-cv`.

**2. One structured generation call; the protocol's guarantees are enforced
server-side.** The Cross-Referencing & Enhancement Protocol (keyword
extraction → alignment → XYZ rewrite → metrics preservation → truth guard)
is embedded in a single prompt on the US-027 `BaseAIWorkflow`
(`workflow_type = 'draft_cv'`, Gemini primary, retry once on invalid JSON).
Mechanical post-validation guards run after Pydantic validation, because a
prompt cannot guarantee them:

- **Metrics guard (hard):** any numeral/percentage/currency token in an output
  bullet that does not occur in the source resume/profile text demotes that
  bullet to `do_not_use_yet` with an explanatory quality note. Source metrics
  that disappeared from the draft are reported as quality notes.
- **Keyword-support guard (hard):** a skill item or prioritized keyword with no
  occurrence in the source resume/profile/accepted-suggestion text is moved to
  `keywords_excluded(reason='unsupported')` and removed from `skills`.
- **XYZ/ATS lint (soft):** bullets must start with an action verb (curated
  lexicon) and respect the length cap (Pydantic `max_length=240`); lint
  violations produce quality notes and can mark the run `needs_review`, never
  silent rewrites.

**3. Deterministic fallback is required, and it never paraphrases.** When no
Gemini key is configured or the provider fails terminally, the fallback builds
the CV mechanically from `candidate_profile_json`, parsed resume sections, job
`extraction_json` keywords, and accepted/`safe_to_use` resume suggestions —
copying source bullet text verbatim (verbatim copies are `safe_to_use` by
construction), `confidence_score = 0.0`, `provider = 'deterministic'`.

**4. Truth Guard and review reuse US-031 semantics.** Bullet
`truth_guard_status` uses the existing snake_case model enum
(`safe_to_use | needs_confirmation | do_not_use_yet`) stored natively in
`cv_json` (the title-case mapping remains a `resume_suggestions` display
concern only). The server assigns each bullet a stable `id` (the model does
not generate ids) and a `user_action` field (`pending | approved | rejected`)
mirroring `resume_suggestions.user_action`. Approvals are per-version and do
not carry across regenerations. Draft `status` is **derived server-side**:
`needs_review` (unresolved `needs_confirmation` bullets or low confidence) →
`ready_to_export` (none unresolved) → `exported` (≥1 successful export).
`draft` exists only as the row default; there is **no `failed` status** — the
`ai_workflow_runs` row records failures and no draft row is written.

**5. Rendering runs in `apps/api`: WeasyPrint for PDF, `python-docx` for
DOCX, Pydantic for validation.** One shared serializer filters `cv_json` by
the export rule (include `safe_to_use` + approved `needs_confirmation`;
exclude everything else) and produces an ordered render model consumed by all
three renderers (web preview, HTML→PDF template, DOCX builder), so the
preview, the PDF, and the DOCX cannot disagree about content. The HTML/CSS
template is the durable "ApplyWise standard resume template v1": single
column, standard section headings, no tables/icons/graphics, bullets ≤ 2
lines. Heavy native deps in `apps/api` have precedent (Docling); WeasyPrint's
pango/cairo install steps are documented in the story packet.

**6. Exports are rendered on demand and streamed; no binary storage.**
`POST /api/draft-cvs/{id}/export/pdf|docx` re-renders from the persisted,
versioned `cv_json` and returns the file with `Content-Disposition`.
"Download again later" is satisfied because rendering a stored version is
deterministic. `draft_cvs` records `last_exported_pdf_at` /
`last_exported_docx_at` instead of the brief's `exported_pdf_url` /
`exported_docx_url`. Export is not an AI run (no `ai_workflow_runs` row); it
writes a `draft_cv.exported` `activity_feed` event. Server-side filtering is
authoritative regardless of UI warnings; export of a CV with zero renderable
bullets fails with `empty_cv`.

## Alternatives Considered

1. **Implement the brief literally (job-scoped endpoints, Puppeteer + docx npm
   in the web tier, Zod, stored export URLs).** Rejected — re-splits AI and
   persistence across two stacks against decision 0012, duplicates ownership
   checks, adds Chromium and first-ever object storage for PII files, and
   makes "the job's draft" ambiguous when a job has matches against multiple
   resumes.
2. **Five chained model calls, one per protocol stage.** Rejected — 5× latency
   and cost, five failure points per generation, and intermediate stages are
   unverifiable; the foundation is one validated call with retry. The
   protocol's guarantees are exactly the things server code can check
   mechanically.
3. **Persist exported binaries in Supabase Storage with signed URLs.**
   Rejected for this period — introduces storage lifecycle, retention, and
   deletion duties for sensitive documents with no user-visible benefit over
   deterministic re-render. Revisit only if rendering cost or an exact-bytes
   archival requirement appears; the `last_exported_*_at` columns and
   activity events keep the door open.
4. **Reuse `resume_versions` + Markdown→PDF instead of a new table.**
   Rejected — Markdown cannot carry per-bullet truth-guard metadata, stable
   bullet ids, approval state, or strategy/keyword structures; retrofitting
   them onto `resume_versions` would break US-032's contract. The Markdown
   draft (US-032) remains as-is; consolidation is a flagged follow-up.
5. **WeasyPrint vs Playwright-rendered HTML vs pure-Python (fpdf2/reportlab).**
   WeasyPrint accepted: real CSS layout without a browser runtime. Playwright
   adds Chromium for one feature; fpdf2/reportlab hand-position text and make
   the template a second, divergent layout implementation. If WeasyPrint's
   native deps prove unworkable in deployment, fpdf2 is the fallback and this
   decision must be updated.

## Consequences

Positive: one provider boundary and one validation path (unchanged); preview,
PDF, and DOCX provably consistent via the shared render model; truth-guard
gating enforced where it cannot be bypassed (server); no PII files at rest; no
new storage infrastructure; versioned drafts with full audit (runs + activity).

Tradeoffs: every download pays a render (acceptable at MVP scale); WeasyPrint
and python-docx add native/runtime deps to `apps/api` (install documented);
keeping `cv_json` as the single source for review state means concurrent
review PATCHes must be last-write-wins per bullet; the metrics guard is
token-based and conservative (it can demote a legitimately reworded metric —
demotion surfaces it for review rather than losing it silently); US-032's
Markdown draft and the Draft CV overlap until a consolidation decision is
made.

## Implementation Note (2026-06-09)

All four stories landed backend + web, 283 API tests + 130 web tests green:

- **Renderer:** fpdf2 (pure Python) replaced WeasyPrint after its native
  Pango/cairo deps proved unavailable locally; `app/services/export/pdf_renderer.py`
  hand-lays the single-column template, `docx_renderer.py` uses python-docx.
  fpdf2 actually yields cleaner ATS text extraction (asserted via pypdf).
- **Gating proven:** `app/services/export/render_model.py` is the single
  `is_renderable` boundary; export tests extract PDF/DOCX text and assert
  approved/safe content present and `do_not_use_yet`/pending/rejected absent in
  both formats, plus a PDF↔DOCX parity test.
- **Web download:** authenticated export is browser-native (Clerk `getToken()` +
  `fetch` + blob download in `draft-cv-export-buttons.tsx`) rather than a Next
  route handler — no route-handler precedent existed in this non-standard Next
  16 build, and CORS is already configured on the API.
- **Unicode:** the PDF normalizes non-latin-1 name glyphs (core-font limit);
  DOCX preserves full Unicode. Both asserted.

## Follow-Up

- US-039 implements migration `0018` (`draft_cvs` + extend the
  `ai_workflow_runs.workflow_type` CHECK with `'draft_cv'` in place per the
  flows/README rule), the workflow, guards, and fallback.
- US-040 implements review/approval UI; US-041 the template + PDF export;
  US-042 the DOCX export.
- Flag for product owner: decide whether the Markdown tailored draft (US-032)
  is folded into Draft CV or kept as a separate lightweight artifact
  (Open Questions).
- Post-MVP candidates: manual bullet text editing (requires re-classification
  of edited claims), binary export archival, additional templates.
