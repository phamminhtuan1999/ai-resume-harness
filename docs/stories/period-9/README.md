# Period 9 — AI Draft CV Export (PDF/DOCX)

## Goal

Close the application loop. Periods 1–8 tell the user *whether and how* to
apply (match score, gaps, suggestions, Markdown draft, cover letter); Period 9
produces the artifact they actually submit: a job-tailored, truth-guarded CV
generated as structured JSON, reviewed and approved by the user, and exported
as an ATS-safe **PDF or DOCX** in the ApplyWise standard resume template.

Source brief: `docs/stories/period-9/brief.md` (verbatim user requirement,
2026-06-09). This period pulls "PDF or DOCX resume export" in from the
post-MVP list (`docs/product/mvp-scope.md`), which US-032 explicitly deferred
("the Markdown Preview component must be designed to accept a future
'Download PDF' button").

## Status (2026-06-09)

**All four stories implemented (backend + web), unit + integration proven.**
API suite **283 passed**, web suite **130 passed**, tsc + ruff + eslint clean.
Two deviations from the plan, both recorded in
`docs/decisions/0013-draft-cv-export-architecture.md`:

- **PDF renderer is fpdf2, not WeasyPrint** — WeasyPrint's native Pango/cairo
  libraries are unavailable in this environment (the decision's pre-authorized
  fallback). The shared render model is the durable contract, so preview, PDF,
  and DOCX remain identical.
- **Web export download is browser-native** (Clerk `getToken()` + `fetch` +
  blob) rather than a Next route handler — no route-handler precedent exists in
  this non-standard Next 16 build and CORS is already configured.

Migration `0018` was **applied to the live Supabase DB** (2026-06-09 via `psql`
+ `SUPABASE_DB_URL`): `draft_cvs` created (unique `(match_id, version)`, both
indexes, RLS) and the `ai_workflow_runs.workflow_type` CHECK widened to accept
`draft_cv` (verified). Known remaining gaps (consistent with the rest of the
suite): browser E2E and open-in-viewer/Word platform checks are pending (no
browser in this run).

## Direction (accepted decisions)

Set by `docs/decisions/0013-draft-cv-export-architecture.md` (which inherits
`0012-ai-workflow-standards.md`):

- **Match-anchored, versioned drafts.** `draft_cvs` rows hang off `matches`
  (resume × job) and are append-only versions; the brief's job-scoped URLs map
  onto `/matches/[matchId]/draft-cv` exactly as decision 0012 mapped the
  Period 8 brief.
- **One generation call on the US-027 foundation** (`workflow_type =
  'draft_cv'`, Gemini primary + deterministic verbatim-copy fallback). The
  brief's five-stage protocol becomes one prompt plus **server-side mechanical
  guards**: metrics guard (no numeral in output that is absent from the
  source), keyword-support guard (unsupported keywords excluded with a typed
  reason), XYZ/ATS lint (action-verb start, ≤ 240 chars).
- **Truth Guard reuses US-031 semantics** (`safe_to_use | needs_confirmation |
  do_not_use_yet`), with server-assigned stable bullet ids and per-bullet
  `user_action` (`pending | approved | rejected`). Draft status is derived
  server-side; there is no `failed` draft status.
- **Rendering lives in `apps/api`**: WeasyPrint (PDF) + python-docx (DOCX) +
  Pydantic validation — not Puppeteer/Zod/docx-npm in the web tier. One shared
  serializer filters `cv_json` (include `safe_to_use` + approved
  `needs_confirmation`; exclude the rest) and feeds web preview, PDF, and DOCX
  so the three can never disagree.
- **On-demand export, no binary storage.** Downloads stream a deterministic
  re-render of the stored version; `last_exported_*_at` columns + an
  `activity_feed` event replace the brief's `exported_*_url` columns.

## Adversarial Review — Brief vs. System (restatements)

The brief was reviewed against the implemented system before slicing. Every
deviation below is deliberate; the brief itself is input material, not the
contract.

| # | Brief says | System reality | Restatement |
| --- | --- | --- | --- |
| 1 | `POST /api/jobs/:jobId/draft-cv`, page `/jobs/:jobId/draft-cv` | All AI artifacts are match-scoped; a job may have matches against several resumes, so "the job's draft" is ambiguous | Match-scoped routes + `/matches/[matchId]/draft-cv`; job detail page links through the match; `job_id` kept on `draft_cvs` for per-job listing |
| 2 | Puppeteer/Playwright, `docx` npm, Zod | AI + validation + persistence live in FastAPI/Pydantic (decision 0012); web tier generates nothing | WeasyPrint + python-docx + Pydantic in `apps/api` |
| 3 | `exported_pdf_url`, `exported_docx_url` stored | The product stores no binary files anywhere today | On-demand render + streamed download; `last_exported_pdf_at`/`last_exported_docx_at`; no object storage, no PII files at rest |
| 4 | Status enum includes `failed` | Foundation writes no domain row on failure (run row carries it) | `draft → needs_review → ready_to_export → exported`, derived server-side |
| 5 | Five-stage AI pipeline executed "internally" | Foundation is one validated call with one retry | One structured call; protocol guarantees enforced as deterministic server guards |
| 6 | No fallback mentioned | Every AI feature must have a typed deterministic fallback (0012) | Verbatim-copy fallback from profile/resume/accepted suggestions, `confidence 0.0` |
| 7 | Bullets carry no ids; approval storage unspecified | Approvals must reference something stable; US-031 already has `user_action` | Server-assigned bullet `id` + per-bullet `user_action` in `cv_json`; approvals are per-version |
| 8 | Fixed 7 skill categories in schema vs 10 keyword groups in protocol | — (internal inconsistency in the brief) | Open `[{category, items}]` list over a recommended vocabulary; empty categories omitted |
| 9 | `export_notes` authored by the model | Duplicates `cv_strategy` and adds hallucination surface | `export_notes` computed server-side at export time from guards + review state |
| 10 | Preconditions require missing-skill analysis | US-031 treats missing skills as optional enrichment; forcing it adds a paid AI run as a gate | Match analysis **required**, missing-skill analysis **optional input** (richer keyword alignment when present) |
| 11 | "Save version button" as a distinct action | `resume_versions` precedent: every generation IS a version | Generate/regenerate creates versions; version list (table) with view + export per version; no separate save action |
| 12 | "Edit fields manually if editing is supported" | Edited claims would need truth-guard re-classification | Out of scope this period; approval toggles only (flagged follow-up) |
| 13 | Truth-guard casing `safe_to_use` etc. | `resume_suggestions` stores title-case display strings; the AI model enum is already snake_case | New `cv_json` stores the snake_case model enum natively; mapping note added to `data-model.md` |

Gaps the brief missed, added by this period: empty-CV export guard
(`empty_cv` error when gating removes all content), dropped-metrics quality
notes, contact fields are never invented (null when absent from
profile/resume), export filtering is server-authoritative (UI warning is not
the enforcement point), `workflow_type` CHECK constraint must be extended by
migration (it is a hard DB constraint from migration `0010`), and activity
events for generation and export.

## Affected Product Docs

- `docs/product/data-model.md` (new `draft_cvs` table; `workflow_type` value)
- `docs/product/ai-workflows.md` (Draft CV generator + export rules)
- `docs/product/overview.md` (new protected page, module responsibility)
- `docs/product/mvp-scope.md` (Period 9 row; export pulled in from post-MVP)
- `docs/stories/backlog.md` (Period 9 epic + stories)

## Feature → Story Map

| Brief area | Story | Title | Lane |
| --- | --- | --- | --- |
| Protocol, JSON schema, DB, generation endpoints | US-039 | Draft CV generation workflow & data model | high-risk |
| Review UI, approvals, versions, entry points | US-040 | Draft CV review & approval UI | normal |
| Standard template + PDF export | US-041 | ATS resume template & PDF export | high-risk |
| DOCX export | US-042 | DOCX export | normal |

Lanes per `docs/FEATURE_INTAKE.md`: US-039 flags data model + external
provider + public contracts + multi-domain (+ hard gate: external provider,
data migration) → high-risk. US-041 flags public contracts + audit/security
(PII document generation) + weak proof (first renderer) + new system
dependency → high-risk; it also defines the durable "standard resume template"
product contract. US-040/US-042 are bounded extensions of patterns the
adjacent high-risk stories establish → normal with stronger validation.

## Sequencing

```text
US-039 (workflow + data model)
  -> US-040 (review & approvals; needs bullets/ids/status from 039)
  -> US-041 (template + PDF; export gating consumes approval state from 040)
  -> US-042 (DOCX; reuses 041's render model and gating)
```

US-041's shared serializer + template are prerequisites for US-042 — do not
parallelize 041/042 with two agents unless the serializer lands first.

## Validation Shape

Per story: backend unit tests with deterministic provider fixtures (no live
Gemini in tests) covering schema validation, guards (metrics/keyword/lint),
fallback, gating filter, ownership denial, and log redaction; integration
tests for endpoints + persistence + run/activity rows; PDF/DOCX content
assertions via text extraction (pypdf / python-docx readback) — exported
content must contain approved text and must not contain `do_not_use_yet` or
unapproved text; web tests for the review/approve/export flow; browser E2E
remains the known suite-wide gap (tracked, not waived).

## Out of Scope (this period)

- Manual editing of generated bullet text (re-opens truth-guard
  classification; follow-up candidate).
- Binary export archival / object storage and signed URLs.
- Multiple visual templates or a template picker; cover-letter PDF export.
- Consolidating the US-032 Markdown draft into Draft CV (open question below).
- Model selector, LangGraph orchestration, Browserbase (still post-MVP).

## Open Questions (flagged to product owner, non-blocking)

1. **US-032 overlap.** ApplyWise will offer both a Markdown tailored draft and
   a structured Draft CV per match. Proposal: Draft CV becomes the canonical
   application artifact and the Markdown page gains a pointer to it;
   consolidation decided after Period 9 ships (per the existing guidance to
   not rework the AI sub-pages until features are refactored).
2. **Demoted-bullet UX.** The metrics guard demotes invented-number bullets to
   `do_not_use_yet`. Alternative is hard generation failure. Demotion is
   specced; veto if silently-excluded bullets feel too permissive.
3. **WeasyPrint native deps** (pango/cairo) must be acceptable in the deploy
   environment; fallback library is pinned in decision 0013.

## Exit Criteria

A user with an analyzed match can generate a draft CV (real AI or
schema-identical fallback) that passes the protocol guards; every bullet
carries evidence + truth-guard status; unresolved `needs_confirmation` items
are visible, approvable, and excluded from export until approved;
`do_not_use_yet` content never appears in any export; PDF and DOCX downloads
render the identical filtered content in the standard template; every
generation is a saved version listed under the match (and queryable by job);
runs, activity events, and redacted logs exist for generation and export; all
four stories are `implemented` in the durable matrix with unit + integration
proof recorded.
