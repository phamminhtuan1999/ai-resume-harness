# Validation

## Proof Strategy

Integration-style assertions on the **produced files** are the core proof:
extract PDF text with pypdf and inspect font resources; open DOCX with
python-docx and inspect style fonts. Unit proof for the registry and
resolution. Visual check of one rendered PDF per profile is required human
evidence (period README). Record proof with `scripts/bin/harness-cli story
update --id US-044 --unit 1 --integration 1 --e2e 0 --platform 0` after the
cases pass.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Registry completeness: every profile has pdf_family, files for "", "B", "I", docx_font, css_stack; `resolve_font_profile` maps unknown/None → `modern_latex`; `resolve_pdf_fonts` returns embedded=True when all files exist, embedded=False when any is missing (monkeypatched dir). |
| Integration (PDF) | Embedded path per profile: output is valid PDF; extracted text contains real `•`, `–`, curly quotes, and "Đặng Quốc Tuấn" (full diacritics) — the latin-1 regression test inverted; page font resources include a subset of the profile family (BaseFont contains e.g. "CMUSerif"). Gating unchanged: approved/safe text present, excluded text absent (existing tokens). Fallback path: with a missing asset, render succeeds, no "?" in text, glyphs transliterated (hotfix behavior), BaseFont is a core font. |
| Integration (DOCX) | `styles["Normal"]` (and Title/Heading 1) font name per profile: modern_latex/classic_latex → "Times New Roman", ats_clean → "Arial"; Unicode name preserved; ATS-safe structure (no tables/images) unchanged; PDF↔DOCX content parity test still green. |
| Integration (router) | export-preview includes `rendering.font_profile` + `font_embedded`; profile read from `rendering_json`; legacy row (null) → `modern_latex`. |
| E2E | Browser download flow — tracked suite-wide gap. |
| Platform | Open one exported PDF per profile in a viewer + the DOCX in Word/Pages — pending human run (recorded, not waived). |

## Fixtures

- The Period 9 `_cv_json()` fixture extended with: name "Đặng Quốc Tuấn",
  summary containing curly quotes + em dash + "99.9%", date range
  "Oct 2022"–"Present" (en dash path).
- A fonts dir monkeypatch pointing at an empty temp dir (fallback path).

## Commands

```text
cd apps/api && .venv/bin/python -m pytest tests/test_draft_cv_fonts.py -q
cd apps/api && .venv/bin/python -m pytest tests/test_draft_cv_export.py -q
cd apps/api && .venv/bin/python -m pytest -q
```

## Acceptance Evidence

Add pytest output, the vendored font versions + license names, and the
visual-check note after verification.
