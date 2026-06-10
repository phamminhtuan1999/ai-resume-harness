# Design

## Domain Model

**FontProfileSpec** (frozen dataclass in `app/services/export/fonts.py`) —
one row per profile, the single registry both renderers and the web CSS stack
read:

```python
FontProfileSpec(
    key="modern_latex",
    display_name="Modern LaTeX",
    pdf_family="CMUSerif",            # fpdf2 family name when embedded
    pdf_files={"": "cmu-serif/cmunrm.ttf", "B": "cmu-serif/cmunbx.ttf",
               "I": "cmu-serif/cmunti.ttf"},
    docx_font="Times New Roman",      # one universal name, no pairs
    css_stack='"Times New Roman", Times, serif',
)
```

Registry: `modern_latex` → CMU Serif; `ats_clean` → Liberation Sans, DOCX
"Arial", css `Arial, Helvetica, sans-serif`; `classic_latex` → Liberation
Serif, DOCX "Times New Roman". `DEFAULT_FONT_PROFILE = "modern_latex"`.
`resolve_font_profile(value)` maps unknown/None → default (legacy rows).

**ResolvedPdfFonts**: `family: str`, `embedded: bool`. `resolve_pdf_fonts
(profile)` verifies every style file exists and is readable; any miss →
`(core fallback family, embedded=False)`. Core fallback family per profile:
serif profiles → "Times", sans → "Helvetica".

## Assets

`apps/api/app/assets/fonts/`:

- `cmu-serif/` — cmunrm.ttf, cmunbx.ttf, cmunti.ttf + `LICENSE` (SIL OFL 1.1,
  from the cm-unicode 0.7.0 distribution).
- `liberation/` — LiberationSans-{Regular,Bold,Italic}.ttf,
  LiberationSerif-{Regular,Bold,Italic}.ttf + `LICENSE` (SIL OFL 1.1).

Only regular/bold/italic are registered (the template uses no bold-italic).
License files are vendored next to the binaries; review before vendoring is a
stop condition (decision 0014 follow-up).

## Application Flow

**PDF (`pdf_renderer.py`).** `render_pdf(render_model, options=None)` gains
`RenderOptions` (dataclass: `font_profile: str = "modern_latex"`; US-045
extends it with page/density fields). On render:

1. `resolve_pdf_fonts(options.font_profile)`.
2. Embedded path: `pdf.add_font(family, style, path)` per style; all
   `set_font` calls use the resolved family; text passes through **unchanged**
   (no transliteration — the fonts cover the glyphs).
3. Fallback path: core family + the existing `_safe()` transliteration map
   (the hotfix becomes the permanent safety net). Never raise for a font
   problem.

`_safe()` therefore becomes `_safe(text, embedded: bool)` (identity when
embedded). The renderer exposes `last-render info` to callers via a small
result object (`PdfRenderInfo(font_profile, font_embedded)`) returned by a
new `render_pdf_with_info(...)`; the plain `render_pdf(...)` bytes signature
stays for existing callers/tests.

**DOCX (`docx_renderer.py`).** `render_docx(render_model, options=None)`
sets `styles["Normal"].font.name`, the heading styles (`Title`, `Heading 1`),
and run-level fonts to the profile's `docx_font`. No embedding, no pairs.

**Router (`draft_cvs.py`).** Export + export-preview read
`row.rendering_json.recommendation.font_profile` (default when null) and pass
`RenderOptions`. Export-preview's response gains a `rendering` block
including `font_profile`, `font_embedded` (from `resolve_pdf_fonts`) so a
fallback is user-visible before download (the "export note" surface; US-045
extends this block with the compression report).

## Interface Contract

- `GET /api/draft-cvs/{id}/export-preview` response += `rendering:
  { font_profile, font_display_name, font_embedded }` (extended by US-045).
- Export endpoints: unchanged shapes; the streamed file's fonts change.

## Data Model

None (reads US-043's `rendering_json`).

## UI / Platform Impact

None in this story; US-046 applies `css_stack` to the preview card
(cosmetic only — the preview remains a content surface, restatement #15).

## Observability

No new logs. A fallback render is observable via the export-preview
`font_embedded: false` flag; no font paths or user text are logged.

## Alternatives Considered

1. Official Latin Modern OTF — rejected: CFF outlines, fpdf2 embeds TTF only;
   CMU Serif *is* Computer Modern Unicode in TTF.
2. Naming proprietary Arial/Times in the PDF — rejected: cannot redistribute
   or embed; Liberation fonts are metric-compatible substitutes (OFL).
3. DOCX primary/fallback pairs per the brief — rejected: OOXML has no per-run
   fallback chain; Word substitution is unpredictable (0014 §2).
4. System-font discovery at runtime — rejected: nondeterministic across
   deploys; vendored assets are the only reproducible option.
