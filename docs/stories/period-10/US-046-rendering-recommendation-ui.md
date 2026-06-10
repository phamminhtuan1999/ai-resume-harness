# US-046 Draft CV UI: Rendering Recommendation & Page Override

## Status

planned

## Lane

normal (display + one form control over contracts US-043/044/045 establish;
stronger validation per the period README)

## Product Contract

On `/matches/[matchId]/draft-cv`, a draft generated after Period 10 shows a
**Rendering recommendation panel**: recommended page count with the
human-readable reason, font profile display name, layout density, and the
model's compression rationale list — e.g. "Recommended format: 1 page ·
Modern LaTeX" (brief §7). The export area gains a **page-count override**
control offering the policy's allowed range (from
`rendering_json.page_policy.max_pages`); choosing a count below the
recommendation shows warning copy ("Some detail may be compressed to fit
N page(s)."); the chosen count rides the export request as `?pages=N`. A
compression summary (from export-preview's report) tells the user what will
be condensed/dropped before they download. Legacy drafts (null
`rendering_json`) show a quiet "Regenerate this draft to get a page and font
recommendation." state instead of the panel, and no override control. The
preview card gets the profile's CSS font stack (cosmetic; the preview remains
a content surface — no simulated page breaks, restatement #15).

## Relevant Product Docs

- `docs/stories/period-10/README.md` (restatements #13, #15; open question 3)
- `docs/decisions/0014-draft-cv-rendering-rework.md` (§5)
- `docs/product/ui-ux-quality.md` (state/form contracts),
  `docs/product/data-model.md` (`draft_cvs.rendering_json`)

## Acceptance Criteria

- Given a draft with `rendering_json`, the panel shows page count + reason,
  font profile display name, density label, and rationale list; values come
  from the stored clamped recommendation (never recomputed client-side).
- Given a legacy draft (null `rendering_json`), the panel area shows the
  regenerate hint and the export buttons behave exactly as Period 9 (no
  `pages` param sent).
- Given the override select, options are 1..`page_policy.max_pages`; default
  selection is the recommended count; choosing below the recommendation
  renders the warning copy; the export fetch URL includes `pages=N` only when
  the user picked a non-default value or the recommended value explicitly.
- Given an export-preview response with `rendering.compression.dropped`
  non-empty, the UI lists what will be condensed (count + first items) near
  the export buttons; `page_overflow=true` renders the overflow note.
- Given an `invalid_page_override` / `no_rendering_recommendation` error
  envelope, the friendly message is shown via the existing error pattern
  (never a raw code).
- The recommendation panel is visible on `needs_review` drafts too
  (recommendation is metadata, not claims — period README open question 3;
  flagged for product-owner veto).

## Design Notes

- Data: `rendering_json` arrives via the existing draft GET (US-043); no new
  endpoints. The compression summary uses
  `GET /api/draft-cvs/{id}/export-preview?pages=N` (US-045) fetched from the
  client export component (it already holds a Clerk token path) when the
  user opens/changes the override.
- View helpers in `apps/web/src/lib/draft-cv-view.mjs` (pure, node-testable):
  `buildRenderingView(rendering_json)` → `{recommendedPages, reason,
  fontProfileLabel, densityLabel, strategy, maxPages, clamped}` (null for
  legacy); `pageOptions(view)`; `overrideWarning(recommendedPages,
  selectedPages)` → string | null.
- Components: extend `draft-cv-export-buttons.tsx` with the select +
  warning + compression summary; new server-rendered panel section in
  `draft-cv/page.tsx`. Design tokens per `docs/product/ui-ux-quality.md`;
  no new client deps.
- Copy follows the brief §7 example tone; font profile display names from
  one map (`Modern LaTeX`, `ATS Clean`, `Classic LaTeX`).

## Validation

`scripts/bin/harness-cli story update --id US-046 --unit 1 --integration 1
--e2e 0 --platform 0` after proof.

| Layer | Expected proof |
| --- | --- |
| Unit | `node --test`: `buildRenderingView` (full, legacy-null, missing-policy fallbacks), `pageOptions` bounds, `overrideWarning` (below → copy, at/above → null); export URL builder includes `pages` correctly. |
| Integration | Page renders panel for a draft with `rendering_json` and the regenerate hint without it (RSC render covered by web test of the view helpers + tsc/eslint; API contract covered in US-045's router tests). |
| E2E | Generate → panel shows recommendation → pick lower count → warning shown → export carries `pages` (browser E2E; tracked suite-wide gap). |
| Platform | Mobile/desktop screenshots of panel + override states (ui-ux-quality proof, pending human run). |

## Harness Delta

None beyond product docs already updated by the period (panel consumes
contracts recorded by US-043/045). Note for next agent: the override is
ephemeral — never persist it client-side beyond component state.

## Evidence

Add `node --test` output and screenshots after validation.
