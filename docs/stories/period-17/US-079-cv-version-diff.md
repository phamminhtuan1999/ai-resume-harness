# US-079 Tailored CV Version Diff (Words/Lines, Any Two Versions)

## Status

implemented

## Lane

normal

## Product Contract

On the Tailored CV page a user can see **what changed between any two CV
versions** in a Git-style diff. A "Version Diff" panel offers FROM/TO version
pickers, a **Words** view (inline added/removed words, line structure
preserved) and a **Lines** view (whole-line unified), and added/removed/net
character stats. The diff reflects exactly the renderable preview content (what
the export contains), not raw JSON. It runs entirely client-side from data
already on the page; no backend call, endpoint, or migration.

## Relevant Product Docs

- `docs/decisions/0024-cv-preview-and-version-diff.md`
- `apps/web/src/lib/word-diff.mjs` (US-061 bullet-level word diff)
- `docs/stories/period-9/` (US-039 versioned draft CVs)

## Acceptance Criteria

- A pure diff module computes, over two texts: a **Words** view (token stream
  with `same`/`added`/`removed` segments, newlines preserved), a **Lines** view
  (whole-line unified rows), and **char stats** (added/removed/net).
- `draftCvToText(cvJson)` serializes a version using the same renderable gating
  as the on-screen preview (`buildDraftCvView`), in preview order.
- The Version Diff panel compares any two versions via FROM/TO pickers (default
  previous → latest), toggles Words/Lines, shows the stat header and an
  added/removed legend, and renders the diff with green (added) / red
  (removed) styling consistent with `DESIGN.md`.
- The panel only appears when ≥2 versions exist; identical or same-version
  selections show honest empty states.

## Design Notes

- Commands/Queries/API: none — `getDraftCvDetail` already loads every version's
  `cv_json`.
- Tables: none.
- Domain rules: `apps/web/src/lib/version-diff.mjs` (`diffWordsByLine`,
  `diffByLine`, `diffCharStats`, `hasVersionDiff`) over one shared LCS;
  `draftCvToText` in `draft-cv-view.mjs`.
- UI surfaces: `VersionDiffPanel` on `/matches/{matchId}/draft-cv`.

## Validation

`scripts/bin/harness-cli story update --id US-079 --unit 1 --integration 0 --e2e 1 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | `version-diff` tests: line/word LCS ordering, newline preservation, char stats, `hasVersionDiff`; `draftCvToText` serializes only renderable content in preview order. |
| Integration | n/a (web-only, no API). |
| E2E | On a draft with ≥2 versions, the panel shows FROM/TO pickers, Words/Lines toggle, char stats, and green/red highlighting; identical versions show the empty state. |
| Platform | n/a |
| Release | None — additive web UI, no env/schema change. |

## Harness Delta

New initiative (Period 17). Shares decision
`0024-cv-preview-and-version-diff.md` with US-078.

## Evidence

Implemented 2026-06-14.

- `apps/web/src/lib/version-diff.mjs`: doc-aware LCS → `diffWordsByLine`
  (inline, newline-preserving), `diffByLine` (unified lines), `diffCharStats`,
  `hasVersionDiff`.
- `draftCvToText(cvJson)` added to `apps/web/src/lib/draft-cv-view.mjs` —
  serializes the renderable preview view to deterministic plain text.
- `apps/web/src/components/draft-cv/version-diff-panel.tsx` (`VersionDiffPanel`)
  — FROM/TO pickers, Words/Lines toggle, ADDED/REMOVED/NET char header, legend,
  green/red inline + unified rendering. Wired into the draft-cv page (shown when
  `versions.length >= 2`).
- Unit: `apps/web/tests/version-diff.test.mjs` (8 tests). Full web suite
  `276 passed`; tsc + lint clean (Node 24).
- Live verification (signed-in browser, draft with 5 versions): Words and Lines
  modes both render the Git-style diff matching the reference; FROM/TO pickers
  recompute stats (e.g. v1→v5 = +9 / −27 / −18 chars); identical v4→v5 shows
  "0 chars" and the identical-content empty state.

Pending:

- none.
