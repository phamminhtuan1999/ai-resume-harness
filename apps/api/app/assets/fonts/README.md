# Vendored Draft CV export fonts (US-044, Period 10)

Embedded (subsetted) into exported PDFs by `app/services/export/fonts.py` +
`pdf_renderer.py`. Vendored — never read from system fonts — so exports are
reproducible across machines and deploys. See
`docs/decisions/0014-draft-cv-rendering-rework.md` §2.

| Directory | Family | Upstream | Version | License |
| --- | --- | --- | --- | --- |
| `cmu-serif/` | CMU Serif (Computer Modern Unicode) | https://cm-unicode.sourceforge.io | 0.7.0 | SIL OFL 1.1 (`cmu-serif/LICENSE`) |
| `liberation/` | Liberation Sans / Liberation Serif | https://github.com/liberationfonts/liberation-fonts | 2.1.5 | SIL OFL 1.1 (`liberation/LICENSE`) |

Profile mapping (PDF): `modern_latex` → CMU Serif (cmunrm/cmunbx/cmunti),
`ats_clean` → Liberation Sans, `classic_latex` → Liberation Serif. Only
regular/bold/italic are vendored — the template uses no bold-italic. DOCX
never embeds; it names one universally available font per profile.

If any file here is missing or unreadable, the renderer falls back to core
PDF fonts + ASCII transliteration (a font problem must never fail an export).
