"""Draft CV font-profile registry (US-044, Period 10).

The single mapping from a ``font_profile`` value to concrete typography on
each surface (decision 0014 §2): vendored libre TTFs embedded in the PDF, one
universally-available font *name* in DOCX (OOXML has no fallback chain and
python-docx cannot embed), and a CSS stack for the web preview card.

``resolve_pdf_fonts`` is the safety boundary: it verifies every style file
exists before the renderer registers anything; a missing/corrupt asset falls
back to core latin-1 fonts + transliteration. A font problem must never fail
an export.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

FONT_DIR = Path(__file__).resolve().parent.parent.parent / "assets" / "fonts"

DEFAULT_FONT_PROFILE = "modern_latex"

# fpdf2 style keys: "" regular, "B" bold, "I" italic (no bold-italic in the
# template).
_STYLES = ("", "B", "I")


@dataclass(frozen=True)
class FontProfileSpec:
    key: str
    display_name: str
    pdf_family: str  # family name registered with fpdf2 when embedded
    pdf_files: dict[str, str]  # style -> path relative to FONT_DIR
    pdf_core_fallback: str  # core font family when assets are unavailable
    docx_font: str  # exactly one name, present on every machine
    css_stack: str  # web preview (cosmetic only)


FONT_PROFILES: dict[str, FontProfileSpec] = {
    "modern_latex": FontProfileSpec(
        key="modern_latex",
        display_name="Modern LaTeX",
        pdf_family="CMUSerif",
        pdf_files={
            "": "cmu-serif/cmunrm.ttf",
            "B": "cmu-serif/cmunbx.ttf",
            "I": "cmu-serif/cmunti.ttf",
        },
        pdf_core_fallback="Times",
        docx_font="Times New Roman",
        css_stack='"Times New Roman", Times, serif',
    ),
    "ats_clean": FontProfileSpec(
        key="ats_clean",
        display_name="ATS Clean",
        pdf_family="LiberationSans",
        pdf_files={
            "": "liberation/LiberationSans-Regular.ttf",
            "B": "liberation/LiberationSans-Bold.ttf",
            "I": "liberation/LiberationSans-Italic.ttf",
        },
        pdf_core_fallback="Helvetica",
        docx_font="Arial",
        css_stack="Arial, Helvetica, sans-serif",
    ),
    "classic_latex": FontProfileSpec(
        key="classic_latex",
        display_name="Classic LaTeX",
        pdf_family="LiberationSerif",
        pdf_files={
            "": "liberation/LiberationSerif-Regular.ttf",
            "B": "liberation/LiberationSerif-Bold.ttf",
            "I": "liberation/LiberationSerif-Italic.ttf",
        },
        pdf_core_fallback="Times",
        docx_font="Times New Roman",
        css_stack='"Times New Roman", Times, serif',
    ),
}


def resolve_font_profile(value: object) -> FontProfileSpec:
    """Unknown/None (incl. legacy pre-0019 rows) -> the default profile."""
    if isinstance(value, str) and value in FONT_PROFILES:
        return FONT_PROFILES[value]
    return FONT_PROFILES[DEFAULT_FONT_PROFILE]


@dataclass(frozen=True)
class ResolvedPdfFonts:
    family: str
    embedded: bool
    files: dict[str, Path]  # style -> absolute path (embedded only)


def resolve_pdf_fonts(
    profile: FontProfileSpec, *, font_dir: Path | None = None
) -> ResolvedPdfFonts:
    base = font_dir if font_dir is not None else FONT_DIR
    files: dict[str, Path] = {}
    for style in _STYLES:
        rel = profile.pdf_files.get(style)
        path = base / rel if rel else None
        if path is None or not path.is_file():
            return ResolvedPdfFonts(
                family=profile.pdf_core_fallback, embedded=False, files={}
            )
        files[style] = path
    return ResolvedPdfFonts(family=profile.pdf_family, embedded=True, files=files)
