"""ATS-safe PDF renderer for the Draft CV (US-041; US-044 fonts; US-045 layout).

Renders the shared render model (already truth-guard filtered by
``render_model.build_render_model``) into the "ApplyWise standard resume
template v1": single column, standard section headings, plain text bullets, no
tables / images / icons / columns / progress bars.

Uses ``fpdf2`` (decision 0013's pre-authorized WeasyPrint fallback). US-044
embeds vendored libre Unicode fonts per ``font_profile`` (real glyphs;
ASCII-transliteration fallback when an asset is missing). US-045 makes margins,
sizes, and line heights config-driven by (page target, density) and adds
``render_pdf_paged`` — a bounded measure loop that compresses (selection-only)
until the rendered page count fits the target or the protected floor wins.
"""

from __future__ import annotations

import logging
import unicodedata
from dataclasses import dataclass
from typing import Any

from app.services.export.compress import MAX_LEVEL, build_compressed_render_model
from app.services.export.fonts import resolve_font_profile, resolve_pdf_fonts
from app.services.export.options import RenderOptions
from app.services.export.render_config import RenderConfig, get_render_config

# fpdf2 subsets embedded TTFs via fontTools, which warns "TeX NOT subset;
# don't know how to subset; dropped" for the CMU Serif font's legacy `TeX `
# table (TeX math metrics, irrelevant to PDF rendering — the glyph outlines
# embed fine). The measure loop renders several times, so this repeats per
# request; quiet it to keep export logs clean. Real subsetting errors still
# surface at ERROR.
logging.getLogger("fontTools.subset").setLevel(logging.ERROR)

_PAGE_FORMAT = "Letter"


@dataclass(frozen=True)
class PdfRenderInfo:
    font_profile: str
    font_embedded: bool
    pages: int


def render_pdf(render_model: dict[str, Any], options: RenderOptions | None = None) -> bytes:
    content, _info = render_pdf_with_info(render_model, options)
    return content


def render_pdf_with_info(
    render_model: dict[str, Any], options: RenderOptions | None = None
) -> tuple[bytes, PdfRenderInfo]:
    """Single render of an already-built render model. Legacy callers (no
    page target) get the Period 9 layout; otherwise the (target, density)
    config governs margins/sizes."""
    opts = options or RenderOptions()
    config = get_render_config(opts.page_target, opts.density)
    return _render(render_model, opts.font_profile, config)


def render_pdf_paged(
    cv_json: dict[str, Any], options: RenderOptions
) -> tuple[bytes, dict[str, Any], dict[str, Any], PdfRenderInfo]:
    """Bounded measure loop (US-045): compress at increasing levels until the
    rendered PDF fits ``page_target`` (or the protected floor overflows it).
    Returns (pdf_bytes, compression_report, render_model, info). The render
    model is returned so DOCX renders the identical compressed content.

    Deterministic for a given (cv_json, options): same level chosen, same bytes
    (modulo PDF metadata), same report."""
    config = get_render_config(options.page_target, options.density)
    target = config.page_target or 1

    content = b""
    info: PdfRenderInfo | None = None
    model: dict[str, Any] = {}
    report: dict[str, Any] = {}
    for level in range(MAX_LEVEL + 1):
        model, report = build_compressed_render_model(
            cv_json,
            config=config,
            level=level,
            prioritized_keywords=options.prioritized_keywords,
        )
        content, info = _render(model, options.font_profile, config)
        if info.pages <= target:
            break

    assert info is not None
    report["measured_pages"] = info.pages
    report["page_overflow"] = info.pages > target
    report["level"] = report.get("level", 0)
    return content, report, model, info


# --- core render ----------------------------------------------------------------


def _render(
    render_model: dict[str, Any], font_profile: str, config: RenderConfig
) -> tuple[bytes, PdfRenderInfo]:
    try:
        from fpdf import FPDF
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError("PDF renderer dependency is unavailable.") from exc

    profile = resolve_font_profile(font_profile)
    fonts = resolve_pdf_fonts(profile)

    pdf = FPDF(format=_PAGE_FORMAT)
    if fonts.embedded:
        for style, path in fonts.files.items():
            pdf.add_font(fonts.family, style=style, fname=str(path))
    pdf.set_margins(config.margin_x_mm, config.margin_top_mm, config.margin_x_mm)
    pdf.set_auto_page_break(auto=True, margin=config.margin_bottom_mm)
    pdf.add_page()
    pdf.set_text_color(17, 17, 17)
    ctx = _Ctx(pdf=pdf, family=fonts.family, embedded=fonts.embedded, cfg=config)

    _header(ctx, render_model.get("contact") or {})
    _summary(ctx, render_model.get("professional_summary") or "")
    _skills(ctx, render_model.get("skills") or [])
    _experience(ctx, "Work Experience", render_model.get("work_experience") or [])
    _projects(ctx, render_model.get("projects") or [])
    _education(ctx, render_model.get("education") or [])
    _certifications(ctx, render_model.get("certifications") or [])

    info = PdfRenderInfo(
        font_profile=profile.key, font_embedded=fonts.embedded, pages=pdf.page_no()
    )
    return bytes(pdf.output()), info


@dataclass
class _Ctx:
    """Per-render state: the FPDF object, resolved typography, and the layout
    config. With embedded fonts, text passes through untouched (full Unicode);
    on the core fallback it is transliterated to latin-1-safe ASCII."""

    pdf: Any
    family: str
    embedded: bool
    cfg: RenderConfig

    def font(self, *, style: str = "", size: float) -> None:
        self.pdf.set_font(self.family, style=style, size=size)

    def safe(self, text: str) -> str:
        return text if self.embedded else _safe(text)


# --- sections -------------------------------------------------------------------


def _header(ctx: _Ctx, contact: dict[str, Any]) -> None:
    pdf, cfg = ctx.pdf, ctx.cfg
    name = ctx.safe(contact.get("full_name") or "")
    if name:
        ctx.font(style="B", size=cfg.name_pt)
        pdf.multi_cell(0, cfg.name_line_mm, name, new_x="LMARGIN", new_y="NEXT")
    line_bits = [
        contact.get("email"),
        contact.get("phone"),
        contact.get("location"),
        contact.get("linkedin_url"),
        contact.get("github_url"),
        contact.get("portfolio_url"),
    ]
    contact_line = "  |  ".join(ctx.safe(str(b)) for b in line_bits if b)
    if contact_line:
        ctx.font(size=cfg.meta_pt)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(0, cfg.meta_line_mm, contact_line, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(17, 17, 17)
    pdf.ln(1)


def _heading(ctx: _Ctx, text: str) -> None:
    pdf, cfg = ctx.pdf, ctx.cfg
    pdf.ln(2)
    ctx.font(style="B", size=cfg.heading_pt)
    pdf.set_text_color(17, 17, 17)
    pdf.multi_cell(0, cfg.heading_line_mm, ctx.safe(text.upper()), new_x="LMARGIN", new_y="NEXT")
    y = pdf.get_y()
    pdf.set_draw_color(180, 180, 180)
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(1.5)


def _summary(ctx: _Ctx, summary: str) -> None:
    if not summary:
        return
    _heading(ctx, "Professional Summary")
    ctx.font(size=ctx.cfg.body_pt)
    ctx.pdf.multi_cell(0, ctx.cfg.body_line_mm, ctx.safe(summary), new_x="LMARGIN", new_y="NEXT")


def _skills(ctx: _Ctx, skills: list[dict[str, Any]]) -> None:
    if not skills:
        return
    _heading(ctx, "Skills")
    pdf, cfg = ctx.pdf, ctx.cfg
    for group in skills:
        items = ", ".join(group.get("items") or [])
        if not items:
            continue
        ctx.font(style="B", size=cfg.body_pt)
        pdf.write(cfg.body_line_mm, ctx.safe(f"{group.get('category') or 'Skills'}: "))
        ctx.font(size=cfg.body_pt)
        pdf.write(cfg.body_line_mm, ctx.safe(items))
        pdf.ln(cfg.body_line_mm + 0.5)


def _entry_header(ctx: _Ctx, primary: str, secondary: str, dates: str) -> None:
    ctx.font(style="B", size=ctx.cfg.body_pt)
    title = primary if not secondary else f"{primary} — {secondary}"
    if dates:
        title = f"{title}  ({dates})"
    ctx.pdf.multi_cell(0, ctx.cfg.body_line_mm + 0.4, ctx.safe(title), new_x="LMARGIN", new_y="NEXT")


def _bullets(ctx: _Ctx, bullets: list[str]) -> None:
    pdf, cfg = ctx.pdf, ctx.cfg
    ctx.font(size=cfg.body_pt)
    for text in bullets:
        if not text.strip():
            continue
        x = pdf.get_x()
        pdf.multi_cell(0, cfg.body_line_mm, ctx.safe(f"• {text}"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(x)
    pdf.ln(1)


def _experience(ctx: _Ctx, heading: str, entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if (e.get("company") or e.get("title") or e.get("bullets"))]
    if not visible:
        return
    _heading(ctx, heading)
    pdf, cfg = ctx.pdf, ctx.cfg
    for entry in visible:
        dates = _date_range(entry.get("start_date"), entry.get("end_date"))
        _entry_header(ctx, entry.get("title") or "", entry.get("company") or "", dates)
        if entry.get("location"):
            ctx.font(style="I", size=cfg.meta_pt)
            pdf.set_text_color(90, 90, 90)
            pdf.multi_cell(
                0, cfg.meta_line_mm, ctx.safe(str(entry["location"])), new_x="LMARGIN", new_y="NEXT"
            )
            pdf.set_text_color(17, 17, 17)
        _bullets(ctx, entry.get("bullets") or [])


def _projects(ctx: _Ctx, entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if (e.get("name") or e.get("bullets"))]
    if not visible:
        return
    _heading(ctx, "Projects")
    cfg = ctx.cfg
    for entry in visible:
        tech = ", ".join(entry.get("tech_stack") or [])
        _entry_header(ctx, entry.get("name") or "", tech, "")
        if entry.get("description"):
            ctx.font(size=cfg.body_pt)
            ctx.pdf.multi_cell(
                0, cfg.body_line_mm, ctx.safe(str(entry["description"])), new_x="LMARGIN", new_y="NEXT"
            )
        _bullets(ctx, entry.get("bullets") or [])


def _education(ctx: _Ctx, entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if e.get("school")]
    if not visible:
        return
    _heading(ctx, "Education")
    cfg = ctx.cfg
    for entry in visible:
        bits = [entry.get("degree"), entry.get("field")]
        line = ", ".join(b for b in bits if b)
        dates = _date_range(entry.get("start_date"), entry.get("end_date"))
        _entry_header(ctx, entry.get("school") or "", line, dates)
        if entry.get("details"):
            ctx.font(size=cfg.body_pt)
            ctx.pdf.multi_cell(
                0, cfg.body_line_mm, ctx.safe(str(entry["details"])), new_x="LMARGIN", new_y="NEXT"
            )
        ctx.pdf.ln(0.5)


def _certifications(ctx: _Ctx, entries: list[dict[str, Any]]) -> None:
    visible = [e for e in entries if e.get("name")]
    if not visible:
        return
    _heading(ctx, "Certifications")
    ctx.font(size=ctx.cfg.body_pt)
    for entry in visible:
        bits = [entry.get("name"), entry.get("issuer"), entry.get("date")]
        line = " — ".join(str(b) for b in bits if b)
        ctx.pdf.multi_cell(0, ctx.cfg.body_line_mm, ctx.safe(f"• {line}"), new_x="LMARGIN", new_y="NEXT")


# --- helpers --------------------------------------------------------------------


def _date_range(start: Any, end: Any) -> str:
    start = str(start).strip() if start else ""
    end = str(end).strip() if end else ""
    if start and end:
        return f"{start} – {end}"
    return start or end or ""


# Typographic glyphs the core latin-1 fonts lack, mapped to ASCII equivalents.
# Used only on the missing-asset fallback path — embedded fonts (US-044) render
# the real glyphs, and DOCX always keeps full Unicode.
_LATIN1_FALLBACKS = str.maketrans(
    {
        "•": "-",  # • bullet
        "‣": "-",  # ‣ triangular bullet
        "⁃": "-",  # ⁃ hyphen bullet
        "▪": "-",  # ▪ black small square
        "‐": "-",  # ‐ hyphen
        "‑": "-",  # ‑ non-breaking hyphen
        "‒": "-",  # ‒ figure dash
        "–": "-",  # – en dash
        "—": "-",  # — em dash
        "―": "-",  # ― horizontal bar
        "‘": "'",  # ‘ left single quote
        "’": "'",  # ’ right single quote
        "‚": "'",  # ‚ low single quote
        "“": '"',  # “ left double quote
        "”": '"',  # ” right double quote
        "„": '"',  # „ low double quote
        "′": "'",  # ′ prime
        "″": '"',  # ″ double prime
        "←": "<-",  # ← leftwards arrow
        "→": "->",  # → rightwards arrow
        # Latin letters NFKD does not decompose, mapped to their ASCII base so
        # names degrade readably (e.g. "Đặng" -> "Dang") instead of to "?".
        "Đ": "D",
        "đ": "d",
        "Ł": "L",
        "ł": "l",
        "Ø": "O",
        "ø": "o",
        "Æ": "AE",
        "æ": "ae",
        "Œ": "OE",
        "œ": "oe",
        "ß": "ss",
    }
)


def _safe(text: str) -> str:
    """Core PDF fonts are latin-1; degrade non-latin-1 glyphs to a readable
    ASCII form instead of raising (the permanent fallback safety net — US-044
    embedded fonts render the real glyphs, and DOCX always keeps full Unicode).

    NFKD splits accented letters into base + combining marks; the marks
    (category ``Mn``) are dropped so tone-heavy scripts (e.g. Vietnamese
    "Quốc" -> "Quoc") survive as plain ASCII rather than question marks. The
    typographic map then handles the renderer's own separators (bullets, en/em
    dashes) and letters NFKD leaves intact."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    normalized = stripped.translate(_LATIN1_FALLBACKS)
    try:
        normalized.encode("latin-1")
        return normalized
    except UnicodeEncodeError:
        return normalized.encode("latin-1", "replace").decode("latin-1")
