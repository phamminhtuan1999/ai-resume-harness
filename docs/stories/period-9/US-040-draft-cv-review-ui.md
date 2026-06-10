# US-040 Draft CV Review & Approval UI

## Status

implemented — backend `PATCH /api/draft-cvs/{id}/bullets/{bulletId}` recomputes
the derived status (`set_bullet_action` + `derive_draft_status`); web page
`/matches/[matchId]/draft-cv` (RSC) with generate/regenerate, CV strategy +
keyword-alignment cards, Truth Guard review panel (per-bullet approve/reject),
gated CV preview (`draft-cv-view.mjs` mirrors the backend `is_renderable`),
quality notes, version-history table, and a match-page entry link. Export
buttons (US-041/042) live on this page. Proof: `test_draft_cv_router.py` (PATCH
approve→ready_to_export, unknown-bullet 404, not-owned 404) + web
`draft-cv-view`/`draft-cv-client` tests; tsc + eslint clean. Browser E2E pending.

## Lane

normal

## Product Contract

On a new protected sub-page `/matches/[matchId]/draft-cv`, the user generates,
reviews, and approves a draft CV. The page shows the CV strategy summary,
keyword alignment (prioritized keywords and excluded keywords with typed
reasons), a structured CV preview that renders **exactly** what export will
contain, Truth Guard warnings, per-bullet Approve/Reject for
`needs_confirmation` items, a Regenerate action, and a version history table.
Approving or rejecting items updates the draft's derived status
(`needs_review` → `ready_to_export`) live. Entry points: a Draft CV row/link
on the match detail page's AI surface and a link from the job detail page
through the job's match(es). Export buttons appear here but ship in
US-041/US-042 (disabled with "coming soon" affordance until those land, per
the brief's UI list).

## Relevant Product Docs

- `docs/stories/period-9/README.md` (direction + restatements; brief §UI)
- `docs/decisions/0013-draft-cv-export-architecture.md` (§1, §4)
- `docs/product/overview.md` (protected pages), `docs/product/ui-ux-quality.md`
  (state/form contracts), `docs/product/data-model.md` (`draft_cvs`)

## Acceptance Criteria

- Given a match with a saved analysis and no draft CV, when the user opens
  `/matches/[matchId]/draft-cv`, then an empty state explains the feature and
  a Generate Draft CV button runs `POST /api/matches/{matchId}/draft-cv` with
  a loading state shaped like the final layout.
- Given a match without a saved analysis, the page shows a guided
  precondition state linking to Generate Analysis instead of a dead button
  (`missing_match_analysis` is never shown raw).
- Given a generated draft, the page renders: strategy card (summary, primary
  positioning), keyword alignment card (prioritized; excluded with
  reason badges `unsupported | weak_evidence | irrelevant`), structured CV
  preview (contact, professional summary, skills by category, experience,
  projects, education, certifications), and quality notes.
- Given the preview, only renderable bullets (`safe_to_use` or approved
  `needs_confirmation`) appear in the main preview; `needs_confirmation`
  pending items are listed in a Truth Guard review panel with their
  `source_evidence`; `do_not_use_yet` items appear only in a collapsed
  "Excluded claims" list with reasons — never styled as part of the CV.
- Given a pending `needs_confirmation` bullet, when the user clicks Approve
  (or Reject), then `PATCH /api/draft-cvs/{draftCvId}/bullets/{bulletId}`
  persists `user_action`, the preview updates without full reload, and when
  the last pending item is resolved the status chip flips to
  `ready_to_export`.
- Given multiple versions, a version history **table** (id/version, status,
  provider, confidence, created) lists them; selecting an older version
  renders it read-only with its own review state.
- Given Regenerate, a new version is created, prior versions stay listed, and
  approvals are not carried over (stated in the confirm dialog).
- Given a run with `confidence_score < 0.5`, an amber Needs review badge with
  the score is shown (foundation convention).
- Given any endpoint error, the friendly error + Retry pattern from the other
  AI sub-pages is used; ownership failures route to the standard
  unauthorized handling.
- Given the match detail page, a Draft CV entry point with current status chip
  is visible; given the job detail page, a Draft CV link routes through the
  job's match (or to match creation when none exists).

## Design Notes

- Commands: none new in API beyond `PATCH
  /api/draft-cvs/{draft_cv_id}/bullets/{bullet_id}` body
  `{ user_action: 'approved' | 'rejected' | 'pending' }` → updates the bullet
  inside `cv_json`, recomputes derived status, bumps `updated_at`, returns the
  updated draft. Last-write-wins per bullet; 404 on unknown bullet id;
  ownership enforced (router: `apps/api/app/routers/draft_cvs.py`).
- Queries: `GET /api/matches/{matchId}/draft-cv` (page load),
  `GET /api/draft-cvs/{id}` (version view).
- API client: extend `apps/web/src/lib/ai-workflow-client.mjs` patterns.
- Tables: none (US-039 owns the schema; PATCH mutates `cv_json` +
  `status`).
- Domain rules: status derivation lives server-side only — the UI never
  computes it; preview filtering uses the same renderable predicate the
  export serializer will use (US-041) to guarantee preview = export.
- UI surfaces: new page `apps/web/src/app/(app)/matches/[matchId]/draft-cv/page.tsx`
  following the §state contract (loading/empty/error/success); version list
  uses the table-list pattern (not cards); design tokens + emerald accent per
  `docs/product/ui-ux-quality.md`; do not modify the five existing AI
  sub-pages beyond adding the entry link.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-040 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | PATCH handler: approve/reject/pending transitions, unknown bullet 404, ownership denial, status recompute (last pending resolved → `ready_to_export`); web: renderable-filter helper, version-table mapping, status-chip mapping. |
| Integration | PATCH persists into `cv_json` and returns updated draft; GET latest reflects review state; regenerate resets review state on the new version only. |
| E2E | Generate → review panel shows pending items → approve all → chip flips to ready_to_export → regenerate creates v2 (browser E2E; tracked with the suite-wide gap if not run). |
| Platform | Mobile + desktop screenshots of the page states (ui-ux-quality proof). |
| Release | Period 9 suite run. |

## Harness Delta

Adds the PATCH route to the public contract (recorded in data-model/ai-workflows
docs via US-039's sections). No new decision — inherits 0013. Note for next
agent: the disabled export buttons are intentional scaffolding for US-041/042.

## Evidence

Add pytest + node --test output and page screenshots after validation.
