# Validation

## Proof Strategy

Pure-function unit proof for config/scoring/levels/floor; integration proof on
the produced files (pypdf page counts and text presence/absence; DOCX
readback) and the router contract. Determinism asserted by double-render
byte/report comparison. Record proof with `scripts/bin/harness-cli story
update --id US-045 --unit 1 --integration 1 --e2e 0 --platform 0` after the
cases pass.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Config table: every (target 1–3 × density) returns a frozen config; px-as-pt sizes; caps per density. Scoring: keyword-evidence > impact-metric > plain bullet; tie → document order. Floor: impact-metric bullet and prioritized-keyword bullet never dropped at any level, even over cap. Levels: L1 reduces older/projects caps; L2 dedupes skills case-insensitively and drops emptied groups; L3 truncates summary at a sentence boundary (never mid-word, ≤ cap). Subset invariant: compressed model bullets ⊆ `build_render_model` bullets for every level (gating cannot be bypassed). Report lists every dropped item with section/entry/reason; `applied=false` at L0 with no drops. Determinism: same (cv_json, config, level) → identical model + report. |
| Integration (files) | Overflowing fixture at target 1: `render_pdf_paged` output has ≤ 1 page when the floor fits, dropped bullet text absent from PDF text but present in the report, protected bullets present; target 2 → fewer/no drops. Floor-overflow fixture: pages > target, `page_overflow=true`, all protected text present. DOCX: built from the identical compressed model — dropped text absent, parity with PDF text on renderable tokens; Normal style size matches config body pt. Legacy row (no `rendering_json`): single render, report `applied=false`, Period 9 content behavior. Double render → identical report and page count. |
| Integration (router) | `?pages=2` within max → honored (PDF page count ≤ 2 given content); `?pages=9` → 422 `invalid_page_override`; `pages` on a legacy row → 422 `no_rendering_recommendation`; `pages=1` when recommendation is 2 → export-preview `override_warning` non-null (and export still streams); export-preview returns the compression report + effective options without producing a download. |
| E2E | US-046 + suite-wide browser gap. |
| Platform | Open a compressed 1-page export and verify the report matches what is visibly absent — human evidence with US-044's visual check. |

## Fixtures

- Overflow fixture: 4+ work entries × 6 bullets (240-char texts), 4 projects,
  long summary — guaranteed > 1 page at standard density.
- Floor fixture: every bullet carries `%`/`$` metrics or prioritized
  `keywords_used` (nothing droppable).
- Mixed fixture: protected and unprotected bullets interleaved with known
  scores, for exact drop-order assertions.

## Commands

```text
cd apps/api && .venv/bin/python -m pytest tests/test_draft_cv_compression.py -q
cd apps/api && .venv/bin/python -m pytest tests/test_draft_cv_export.py tests/test_draft_cv_router.py -q
cd apps/api && .venv/bin/python -m pytest -q
```

## Acceptance Evidence

Add pytest output and the double-render determinism note after verification.
