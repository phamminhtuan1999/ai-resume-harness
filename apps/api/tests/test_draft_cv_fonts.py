"""US-044 font-profile tests: registry, resolution, embedded PDF glyph
fidelity + subset presence, safe fallback, and DOCX font names.

The embedded path is the durable fix for the latin-1 "?" defect (intake #41):
real bullets / en dashes / curly quotes / full diacritics must survive text
extraction. The fallback path must never raise and never emit "?".
"""

from __future__ import annotations

import io
from pathlib import Path

import pytest
from pypdf import PdfReader

from app.services.export.docx_renderer import render_docx
from app.services.export.fonts import (
    DEFAULT_FONT_PROFILE,
    FONT_PROFILES,
    resolve_font_profile,
    resolve_pdf_fonts,
)
from app.services.export.options import RenderOptions
from app.services.export.pdf_renderer import render_pdf, render_pdf_with_info

_GLYPH_RENDER_MODEL = {
    "contact": {"full_name": "Đặng Quốc Tuấn", "email": "tuan@example.vn"},
    "professional_summary": "Shipped “zero-downtime” migrations — 99.9% uptime.",
    "skills": [{"category": "Backend", "items": ["FastAPI"]}],
    "work_experience": [
        {
            "company": "DataHouse",
            "title": "Senior Engineer",
            "start_date": "Oct 2022",
            "end_date": "Present",
            "bullets": ["Engineered platform services for production workflows."],
        }
    ],
    "projects": [],
    "education": [],
    "certifications": [],
}


def _pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _pdf_base_fonts(pdf_bytes: bytes) -> set[str]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    fonts: set[str] = set()
    for page in reader.pages:
        for font in (page.get("/Resources", {}).get("/Font") or {}).values():
            base = font.get_object().get("/BaseFont")
            if base:
                fonts.add(str(base))
    return fonts


# --- registry + resolution ------------------------------------------------------


def test_registry_is_complete() -> None:
    assert set(FONT_PROFILES) == {"modern_latex", "ats_clean", "classic_latex"}
    for spec in FONT_PROFILES.values():
        assert spec.display_name and spec.pdf_family and spec.docx_font and spec.css_stack
        assert set(spec.pdf_files) == {"", "B", "I"}


def test_resolve_font_profile_defaults_unknown_and_none() -> None:
    assert resolve_font_profile("ats_clean").key == "ats_clean"
    assert resolve_font_profile(None).key == DEFAULT_FONT_PROFILE
    assert resolve_font_profile("nonsense").key == DEFAULT_FONT_PROFILE
    assert resolve_font_profile(123).key == DEFAULT_FONT_PROFILE


def test_resolve_pdf_fonts_present_and_missing(tmp_path: Path) -> None:
    profile = FONT_PROFILES["modern_latex"]
    resolved = resolve_pdf_fonts(profile)
    assert resolved.embedded is True
    assert resolved.family == "CMUSerif"
    assert set(resolved.files) == {"", "B", "I"}
    # An empty dir has no assets -> fall back to the core family.
    missing = resolve_pdf_fonts(profile, font_dir=tmp_path)
    assert missing.embedded is False
    assert missing.family == "Times"  # core fallback for the serif profile
    assert missing.files == {}


# --- embedded PDF glyph fidelity ------------------------------------------------


@pytest.mark.parametrize(
    ("profile", "family_marker"),
    [
        ("modern_latex", "CMUSerif"),
        ("ats_clean", "LiberationSans"),
        ("classic_latex", "LiberationSerif"),
    ],
)
def test_embedded_pdf_renders_real_glyphs(profile: str, family_marker: str) -> None:
    content, info = render_pdf_with_info(
        _GLYPH_RENDER_MODEL, RenderOptions(font_profile=profile)
    )
    assert content[:5] == b"%PDF-"
    assert info.font_embedded is True
    assert info.font_profile == profile

    text = _pdf_text(content)
    assert "?" not in text
    assert "Đặng Quốc Tuấn" in text  # full diacritics, the inverted regression
    assert "•" in text  # real bullet, not "-"
    assert "–" in text  # real en dash in the date range
    assert "“" in text and "”" in text  # curly quotes survive

    base_fonts = _pdf_base_fonts(content)
    assert any(family_marker in bf for bf in base_fonts)
    # Subset prefix (six uppercase letters + "+") proves embedding/subsetting.
    assert any("+" in bf for bf in base_fonts)


def test_fallback_path_transliterates_without_question_marks(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Point the font dir at an empty location: every profile loses its assets.
    monkeypatch.setattr("app.services.export.fonts.FONT_DIR", tmp_path)
    content, info = render_pdf_with_info(
        _GLYPH_RENDER_MODEL, RenderOptions(font_profile="modern_latex")
    )
    assert content[:5] == b"%PDF-"
    assert info.font_embedded is False
    text = _pdf_text(content)
    assert "?" not in text  # the safety net: degrade to ASCII, never "?"
    # Combining marks stripped so the Vietnamese name degrades readably.
    assert "Dang Quoc Tuan" in text
    # The renderer's own typographic glyphs degraded to ASCII on the core path.
    assert "•" not in text and "–" not in text and "“" not in text
    base_fonts = _pdf_base_fonts(content)
    assert any("Times" in bf for bf in base_fonts)


# --- DOCX font names ------------------------------------------------------------


@pytest.mark.parametrize(
    ("profile", "expected_font"),
    [
        ("modern_latex", "Times New Roman"),
        ("ats_clean", "Arial"),
        ("classic_latex", "Times New Roman"),
    ],
)
def test_docx_applies_profile_font(profile: str, expected_font: str) -> None:
    from docx import Document

    docx_bytes = render_docx(_GLYPH_RENDER_MODEL, RenderOptions(font_profile=profile))
    doc = Document(io.BytesIO(docx_bytes))
    assert doc.styles["Normal"].font.name == expected_font
    assert doc.styles["Heading 1"].font.name == expected_font
    # Unicode name preserved regardless of profile (DOCX always full Unicode).
    assert any("Đặng Quốc Tuấn" in p.text for p in doc.paragraphs)


def test_default_render_pdf_still_works_without_options() -> None:
    # Back-compat: the plain bytes signature defaults to modern_latex embedded.
    content = render_pdf(_GLYPH_RENDER_MODEL)
    assert content[:5] == b"%PDF-"
