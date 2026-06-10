# Design

## Domain Model

**RenderConfig** (frozen dataclass, `app/services/export/render_config.py`),
selected by `get_render_config(page_target: int, density: str)` from a frozen
table — never computed at render time:

- Page geometry by target (brief §4, in→mm): target 1 → margins top/bottom
  11.4 mm, left/right 14.0 mm, line factor 1.15; target 2–3 → 12.7/15.2 mm,
  1.18.
- Sizes (px-as-pt, 0014 §4): name 18 pt, heading 12 pt, body 10 pt,
  metadata 9 pt — all targets.
- Selection caps by density: compact → recent-entry bullet cap 4, older 2,
  projects 2, summary 360 chars; standard → 5/3/3/480; spacious → 6/4/4/600.
  "Recent" = first 2 work entries (document order). Density also nudges the
  line factor (compact −0.02, spacious +0.05).

**Compression** (`app/services/export/compress.py`) — pure, deterministic,
selection-only. `build_compressed_render_model(cv_json, *, config, level,
prioritized_keywords) -> (render_model, report)`:

- Bullet score = 3·(has prioritized-keyword evidence via `keywords_used`) +
  2·(has impact metric `$`/`%` token) + 1·(has any metric-like token); ties
  break by document order (earlier wins). Scoring reads `cv_json` bullets
  (the render model strips metadata), then emits the **same plain render-model
  shape** as `build_render_model` — compressed output is always a subset of
  the gated model (`is_renderable` remains the only gating predicate;
  compression never resurrects gated content).
- **Protected floor**: a renderable bullet with an impact metric or
  prioritized-keyword evidence is never dropped by any level. Caps apply to
  unprotected bullets first; an entry whose protected bullets alone exceed its
  cap keeps them all.
- Levels (each includes the previous; the measure loop walks them in order):
  - L0 — density caps as configured.
  - L1 — older entries cap −1 (min 1); projects cap −1 (min 1).
  - L2 — recent cap −1 (min 2); older cap → 1; skill dedupe (case-insensitive
    item dedupe across groups, drop emptied groups — brief step 4).
  - L3 — professional summary truncated at a sentence boundary to the summary
    cap; projects → 1 (most relevant by aggregate bullet score).
- Report: `{applied, level, steps_applied[], dropped: [{section, entry,
  kind, text, reason}], skills_deduped[], summary_truncated, measured_pages,
  page_target, page_overflow, density, protected_kept}`. Every removed item
  is listed.

## Application Flow

**Measure loop** (`pdf_renderer.render_pdf_paged(cv_json, options) ->
(bytes, report)`):

```text
for level in 0..3:
    model, report = build_compressed_render_model(cv_json, config(level), …)
    bytes, pages = _render(model, options)        # fpdf page_no(), no re-parse
    if pages <= page_target: break
report.measured_pages = pages
report.page_overflow = pages > page_target        # floor beat the target
```

Bounded (≤ 4 renders, ms-scale each), deterministic per (cv_json, options).
`RenderOptions` (US-044) gains `page_target: int | None`, `density: str`,
and `prioritized_keywords: list[str]`. `page_target=None` (legacy rows) ⇒
single uncompressed render, no loop, report `applied=false` — Period 9
behavior preserved byte-for-byte except fonts.

**DOCX**: `render_docx(model, options)` consumes the **same compressed
model** chosen by the PDF loop (router renders PDF-measure first or reuses
the compression level computed by export-preview… no: DOCX export runs its
own loop-equivalent by calling the compression with the level the PDF
measure selects — the router calls `render_pdf_paged` to determine the
level/report, then feeds the identical model to `render_docx`). Sizes/line
spacing map from the same config (Pt values). Content parity stays tested;
page parity is best-effort (restatement #11).

**Override + validation (router)**: export + export-preview accept
`pages: int | None` (query param). With `rendering_json` present: allowed
range = `[1, page_policy.max_pages]`; outside → 422 `invalid_page_override`.
Below `recommendation.recommended_page_count` → response carries
server-computed warning copy (`export-preview.rendering.override_warning`;
brief §8 "some detail may be compressed"). Without `rendering_json` (legacy
row): `pages` present → 422 `no_rendering_recommendation` ("Regenerate this
draft to enable page targeting."); absent → legacy render.

**export-preview** gains the full `rendering` block: recommendation, policy,
effective options (profile/density/target after override), `font_embedded`
(US-044), `compression` report (computed via the same measure loop, file
discarded), `override_warning`.

## Interface Contract

- `POST /api/draft-cvs/{id}/export/pdf?pages=N` / `export/docx?pages=N` —
  optional override, validated as above; file streams as before.
- `GET /api/draft-cvs/{id}/export-preview?pages=N` — adds
  `rendering.compression` (report), `rendering.effective`,
  `rendering.override_warning`.
- New error codes: `invalid_page_override`, `no_rendering_recommendation`
  (422, non-retryable, friendly messages).

## Data Model

None. Overrides are never stored (0014 §5).

## UI / Platform Impact

US-046 renders the report and the override control; nothing here.

## Observability

The compression report is returned, not logged (CV text must stay out of
logs). `draft_cv.exported` activity events unchanged.

## Alternatives Considered

1. Compression at export only, preview untouched (brief literal) — rejected:
   desynchronizes surfaces (0014 §3); the report keeps the user informed
   instead.
2. Hard failure when the floor overflows the target — rejected: the brief's
   own policy allows overflow for important evidence; note + proceed.
3. Estimating page count from line math instead of rendering — rejected:
   duplicate layout model that drifts from fpdf2's real wrapping; rendering
   is cheap.
4. Storing the chosen level/report on the row — rejected: derived data,
   recomputable deterministically; storage adds staleness risk.
