# Period 10 — Draft CV Rendering Rework (Page Length, Fonts, Compression)

## Goal

Period 9 shipped a correct Draft CV pipeline (truth-guarded structured JSON →
shared render model → PDF/DOCX). Period 10 makes the *document* worth
submitting: a deterministic page-count recommendation grounded in the
candidate's experience, an ApplyWise-controlled LaTeX-style font system
(embedded, Unicode-capable fonts instead of latin-1 core fonts), page-aware
layout configs, and a deterministic compression pass so the export lands on
the recommended page count without destroying job-critical evidence. This is
an enhancement of the existing flow — generation pipeline, render-model
boundary, and Truth Guard semantics are unchanged.

Source brief: `docs/stories/period-10/brief.md` (verbatim user requirement,
2026-06-09). Direction: `docs/decisions/0014-draft-cv-rendering-rework.md`
(extends 0013, inherits 0012).

## Status (2026-06-09)

**All four stories implemented (backend + web), unit + integration proven.**
API suite **303 passed**, web suite **137 passed**, ruff + tsc + eslint clean.
Migration `0019` (additive `draft_cvs.rendering_json`) **applied to the live
Supabase DB** (2026-06-09 via `psql` + `SUPABASE_DB_URL`, `jsonb` column
verified). US-044 visual check **done**: one PDF per font profile rendered and
inspected — "Đặng Quốc Tuấn", curly quotes, en/em dashes, and bullets all
render correctly in the embedded Computer Modern serif (the latin-1 `?` defect
is durably fixed; full diacritics now survive). Known remaining gaps
(suite-wide): browser E2E and open-in-Word/viewer platform checks.

Direction: `docs/decisions/0014-draft-cv-rendering-rework.md` (accepted,
registered). Traces #86 (high-risk backend trio) and #87 (UI) recorded against
intake #42.

Context that triggered this period: a user-exported PDF showed `?` in place of
every bullet glyph, en dash, and curly quote ("Senior Software Engineer ?
DATAHOUSE ASIA (Oct 2022 ? Present)"). Root cause: fpdf2 **core fonts are
latin-1** and the renderer's own separators (`•`, `–`, `—`) are outside
latin-1, so `_safe()` replace-encoded them to `?`. An interim transliteration
hotfix shipped 2026-06-09 (tiny lane, intake #41, trace #85): those glyphs
degrade to ASCII (`-`, `'`, `"`). US-044 shipped the durable fix — embedded
Unicode fonts that render the real glyphs; `_safe()` (now the permanent
missing-asset fallback) was strengthened to strip combining marks so "Đặng
Quốc Tuấn" degrades to "Dang Quoc Tuan" rather than question marks.

## Adversarial Review — Brief vs. System (restatements)

The brief is input material, not the contract. Every deviation below is
deliberate.

| # | Brief says | System reality | Restatement |
| --- | --- | --- | --- |
| 1 | "The AI determines the recommended page count" | The brief itself supplies a deterministic rules table keyed on years of experience; decisions 0012/0013 require protocol guarantees as server code, not prompt hopes; `user_profiles.years_of_experience` is a first-class column | The **server** computes the authoritative page policy (target + max allowed) and **clamps** the model's `recommended_page_count` into it; the model contributes the human-readable reason, density, and compression rationale. A `policy_clamped` quality note records disagreement |
| 2 | Inputs include "candidate years of experience, seniority" (assumed available) | `user_profiles.years_of_experience` exists; profile work-experience dates are free-form strings ("Oct 2022"); job seniority lives in `jobs.structured_json` only when extraction produced it (that schema is being reworked concurrently) | Policy reads the profile column first; falls back to a conservative span-parse of work-history dates; if both unavailable → default band (target 1, max 2) + `yoe_unknown` note. Job seniority is **optional enrichment** (same stance as Period 9 #10), via structured_json + title keywords |
| 3 | PDF fonts: "Latin Modern Roman", "Arial", "Computer Modern Unicode" | (a) fpdf2 embeds TrueType-outline fonts; official Latin Modern ships CFF/OTF; (b) Arial and Times New Roman are proprietary — ApplyWise cannot redistribute or embed them; (c) Latin Modern *is* modernized Computer Modern — the brief's modern vs classic PDF fonts are near-identical | Bundle libre, style/metric-equivalent TTFs: `modern_latex` → **CMU Serif** (Computer Modern Unicode — the LaTeX look, TTF, libre), `ats_clean` → **Liberation Sans** (Arial-metric-compatible, SIL OFL), `classic_latex` → **Liberation Serif** (Times-metric-compatible). PDF embeds subsets; license review is a stop condition before vendoring |
| 4 | DOCX primary/fallback font pairs (e.g. "Latin Modern Roman" → "Times New Roman") | OOXML has no per-run fallback chain; Word substitutes missing fonts unpredictably from its own tables; python-docx does not embed fonts | DOCX gets **one font name per profile**, chosen to exist everywhere: `modern_latex` → "Times New Roman" (the brief's own fallback, applied directly for predictability), `ats_clean` → "Arial", `classic_latex` → "Times New Roman". Deliberate divergence, recorded in 0014 §2 |
| 5 | "If the selected font is unavailable, fall back safely" | Fonts will be vendored repo assets, not system fonts — "unavailable" means a missing/corrupt asset file | Fallback = core Helvetica/Times + the existing `_safe()` transliteration path (the 2026-06-09 hotfix becomes the permanent safety net) + an export note. A font problem must never fail an export |
| 6 | Font sizes in px (body "10px") | PDF/DOCX are point-based; 10px ≈ 7.5pt is illegible — the numbers are CSS-thinking approximations | Read the brief's px values **as points** (name 18pt / heading 12pt / body 10pt / metadata 9pt — current renderer is 19/12/10.5/9pt, converging); margins converted in→mm; all of it in a typed `RenderConfig` keyed by (page target, density) |
| 7 | "If the generated CV exceeds the recommended page count, apply compression before export" | Period 9's core invariant: **one** render model feeds preview, PDF, and DOCX; compression applied only at export would silently desynchronize preview from the file | Compression is a deterministic transform **inside the shared render-model build**, parameterized by (page target, density); preview, export-preview, PDF, and DOCX all see the same compressed result, plus a machine-readable compression report |
| 8 | Compression step 6: "Reduce bullet wording while preserving meaning" | Rewriting claim text at export time creates new unverified claims — a Truth Guard bypass (guards ran against the generated text) | Export-time compression is **selection-only** (rank, cap, drop, sentence-boundary truncation of the summary) — never rewording. Wording-to-fit is a *generation-time* concern: the prompt tells the model its page target. Brief steps 1–5 map to mechanical operations; step 7 is the protected floor |
| 9 | Compression must fit the page target AND "must not remove" job-critical evidence/metrics/recent experience | Internal contradiction when protected content alone overflows the target | Protected floor **wins**; page target is soft. If the floor still overflows, export proceeds with a `page_overflow` export note — which the brief's own policy endorses ("allow 2 pages if important evidence cannot fit cleanly on 1 page") |
| 10 | `compression_strategy` strings in the AI output | Same class as Period 9 #9 (`export_notes`): model-authored prose describing behavior the server must guarantee | The model's strings are displayed as **rationale only**; the server applies its own ordered mechanical steps and records the applied steps separately in the compression report |
| 11 | "DOCX must preserve the same page count recommendation where possible" | python-docx has no layout engine; the server cannot measure DOCX pages — pagination happens in the reader's Word install | DOCX receives the identical compressed render model and equivalent font/size/spacing settings; page parity is best-effort by construction, content parity is guaranteed and tested. PDF (measurable via pypdf) is the page-count enforcement surface |
| 12 | "Renderer must respect recommended page count" (`max_pages`) | fpdf2 renders then paginates; the only honest enforcement is measure → compress → re-render | A bounded measure loop: render, count pages, apply the next compression step, repeat until target or protected floor. Deterministic per (cv_json, options) |
| 13 | User override "1-page or 2-page export, if supported" | Versions are append-only; an override must not mutate a stored draft | Override is a **render parameter** (`pages`, validated to the policy's allowed range) on export + export-preview endpoints; no stored mutation, no new version. Below-recommendation override → server-computed warning copy (brief §8) |
| 14 | Rendering recommendation lives in the CV JSON | `cv_json` is pure reviewable content; `assign_bullet_ids` already strips strategy/notes/confidence out of it | New nullable `draft_cvs.rendering_json` column (migration 0019, additive): clamped recommendation + policy snapshot + the model's pre-clamp values. Pre-0019 version rows render with legacy defaults (modern_latex, no page targeting) and the UI says "regenerate for a recommendation" |
| 15 | `html_fallback` font stacks (implies preview font fidelity) | The web preview is a content-fidelity surface (gated bullets), not WYSIWYG; browser pagination cannot mirror fpdf2 | Apply the profile's CSS stack to the preview card (cheap, cosmetic) but never simulate page breaks in the browser; measured page count comes from the export-preview endpoint |

Gaps the brief missed, added by this period: the latin-1/`?` defect itself
(brief assumes fonts merely look wrong — they were *dropping* glyphs); the
3-page "exceptional cases" gate needs mechanical proxies (title keywords
principal/staff/distinguished/research + profile publication/patent markers),
otherwise every 12+ y candidate's model output can claim exceptionality;
deterministic behavior of compression (same inputs → same document) is an
explicit requirement so re-exports are reproducible; the compression report
must list dropped/condensed items (silently shrinking a user-approved CV is a
trust violation); font assets must carry license files in-repo.

## Direction (accepted decisions — 0014)

1. **Deterministic page policy clamps the model** (server-side
   `page_policy.py`; bands normalized from the brief; SE default: target 1,
   allow 2 at ≥5 y or on evidence-volume trigger; 3 pages only behind the
   exceptional gate at 12+ y).
2. **Three font profiles, vendored libre TTFs, embedded in PDF, name-only in
   DOCX**; safe fallback to core fonts + transliteration; embedded path is
   full Unicode (real `•`/`–`, full diacritics).
3. **Compression is selection-only, ordered, deterministic, inside the shared
   render model**, with a protected floor that beats the page target and a
   user-visible report.
4. **`RenderConfig` keyed by (page target, density)**, pt-based (brief's px
   read as pt), per-entry bullet caps, 240-char bullet cap retained.
5. **Override = render parameter** within policy bounds; warning copy when
   below recommendation.
6. **Storage in `draft_cvs.rendering_json`** (migration 0019, additive);
   `cv_json` stays content-only; legacy rows keep legacy rendering.

## Affected Product Docs

- `docs/product/data-model.md` (`draft_cvs.rendering_json`)
- `docs/product/ai-workflows.md` (Draft CV Generator: rendering
  recommendation, page policy, compression, font profiles)
- `docs/stories/backlog.md` (Period 10 epic + stories)
- `docs/product/mvp-scope.md` (Period 10 row)

## Feature → Story Map

| Brief area | Story | Title | Lane |
| --- | --- | --- | --- |
| §1 §2 §8: recommendation object, page policy, storage | US-043 | Rendering recommendation & page-count policy | high-risk |
| §3 §6: font profiles, embedded fonts, DOCX mapping, fallback | US-044 | Font profiles & embedded Unicode font rendering | high-risk |
| §4 §5 §8: render configs, max_pages, compression, override | US-045 | Page-aware layout & deterministic compression | high-risk |
| §7: recommendation panel, override control, copy | US-046 | Draft CV UI: rendering recommendation & override | normal |

Lanes per `docs/FEATURE_INTAKE.md`: US-043 hits the data-migration hard gate
(+ public contracts, external provider prompt change, existing behavior,
multi-domain). US-044 adds a new system dependency class (vendored binary
font assets + licensing) on a PII-document surface with weak existing proof.
US-045 changes what exported documents contain (audit/trust surface: content
selection must be transparent) on existing behavior with weak proof. US-046
is display + a form control over contracts the other stories establish →
normal with stronger validation.

## Sequencing

```text
US-043 (recommendation + policy + storage)
  -> US-044 (fonts; renderer reads rendering_json's font_profile)
  -> US-045 (layout + compression; measure loop needs final font metrics from 044
             and the page target from 043)
  -> US-046 (UI; displays 043's recommendation and 045's report/override)
```

Strict order. Do not parallelize 044/045: page measurement depends on the
embedded fonts' metrics — compression tuned on core-font metrics would be
re-tuned immediately.

## Validation Shape

Per story: pure-function unit tests (policy band matrix incl. boundary years,
clamp behavior, rank/caps/floor invariants, registry completeness,
deterministic same-input-same-output); integration tests asserting on the
**produced files** (pypdf page count ≤ target, embedded font subsets present,
real `•`/`–`/diacritics in extracted text on the embedded path, protected
bullets present and dropped bullets absent from the PDF but listed in the
report, DOCX font names per profile, content parity PDF==DOCX==preview);
fallback paths (missing font asset → 200 + note + core fonts); override
endpoint validation (allowed range, warning copy); web tests for the
recommendation panel, override control, and legacy-version state. Browser E2E
remains the tracked suite-wide gap. Visual check of one rendered PDF per font
profile is required human evidence.

## Out of Scope (this period)

- Manual editing of bullet text (unchanged from Period 9).
- A user-facing **font** picker — the brief has the AI/default choose the
  profile; only the **page-count** override is user-facing.
- Export-time bullet rewording / AI-powered compression (Truth Guard bypass).
- WYSIWYG paginated preview in the browser.
- Binary storage, template variants beyond the three profiles, cover-letter
  export (all unchanged from Period 9).

## Open Questions (flagged to product owner, non-blocking)

1. **modern_latex in DOCX.** We map it to "Times New Roman" directly
   (predictable on every machine) instead of naming "Latin Modern Roman" and
   praying Word substitutes well. Veto if you'd rather name LM Roman for the
   minority of readers who have it installed.
2. **Compression aggressiveness defaults.** Per-entry bullet caps (recent
   entries keep ~4–5, older keep ~2 at 1-page/compact) are a taste parameter;
   US-045 freezes initial values — tune after seeing real exports.
3. **Should `needs_review` drafts surface the recommendation panel before
   approval is done?** Planned: yes (recommendation is metadata, not claims),
   but flag if you want it gated.

## Exit Criteria

A generated draft stores a policy-clamped rendering recommendation with a
human-readable reason; exports honor font profile (embedded libre fonts, real
typographic glyphs, full Unicode names) and page target (measured via the PDF,
compression selection-only with a protected floor and a visible report); the
brief's §8 acceptance criteria hold under the restatements above; a user can
override the page count within policy bounds and is warned below the
recommendation; preview == PDF == DOCX still holds for the compressed model;
all four stories `implemented` in the matrix with unit + integration proof.
