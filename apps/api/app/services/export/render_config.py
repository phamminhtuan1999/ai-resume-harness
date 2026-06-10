"""Page-aware render configuration for Draft CV exports (US-045, Period 10).

A typed, frozen ``RenderConfig`` keyed by (page target, layout density) —
margins, point sizes, line heights, and the selection caps the deterministic
compression uses (decision 0014 §4). The brief's px values are read **as
points** (name 18 / heading 12 / body 10 / metadata 9). ``page_target=None``
yields the legacy (pre-Period-10) layout so older drafts render unchanged
except for fonts.

Pure data; no I/O. The table is frozen here and tuned later (decision 0014
follow-up / period README open question 2).
"""

from __future__ import annotations

from dataclasses import dataclass

_PT_TO_MM = 0.352778

# Density -> (recent-entry bullet cap, older-entry bullet cap, project limit,
# professional-summary char cap). "Recent" = the first RECENT_ENTRY_COUNT work
# entries in document order.
_DENSITY_CAPS = {
    "compact": (4, 2, 2, 360),
    "standard": (5, 3, 3, 480),
    "spacious": (6, 4, 4, 600),
}
RECENT_ENTRY_COUNT = 2
BULLET_MAX_CHARS = 240  # retained from US-039 schema; bullets never re-flow past it


@dataclass(frozen=True)
class RenderConfig:
    page_target: int | None
    density: str
    # Margins (mm); top/bottom and left/right differ per the brief's configs.
    margin_top_mm: float
    margin_bottom_mm: float
    margin_x_mm: float
    # Point sizes.
    name_pt: float
    heading_pt: float
    body_pt: float
    meta_pt: float
    # Line heights (mm), derived from pt * line_factor in the builder.
    name_line_mm: float
    heading_line_mm: float
    body_line_mm: float
    meta_line_mm: float
    # Selection caps for compression.
    recent_bullet_cap: int
    older_bullet_cap: int
    recent_entry_count: int
    project_limit: int
    summary_cap: int


def _legacy_config(density: str) -> RenderConfig:
    """The Period 9 layout (single 16mm margin, 19/12/10.5/9pt) used for rows
    without a rendering recommendation. Caps are generous (no page targeting),
    so compression is effectively off."""
    return RenderConfig(
        page_target=None,
        density=density,
        margin_top_mm=16.0,
        margin_bottom_mm=16.0,
        margin_x_mm=16.0,
        name_pt=19.0,
        heading_pt=12.0,
        body_pt=10.5,
        meta_pt=9.0,
        name_line_mm=8.0,
        heading_line_mm=6.0,
        body_line_mm=5.0,
        meta_line_mm=4.6,
        recent_bullet_cap=99,
        older_bullet_cap=99,
        recent_entry_count=RECENT_ENTRY_COUNT,
        project_limit=99,
        summary_cap=10_000,
    )


def get_render_config(page_target: int | None, density: str = "standard") -> RenderConfig:
    if density not in _DENSITY_CAPS:
        density = "standard"
    if page_target is None:
        return _legacy_config(density)

    target = max(1, min(int(page_target), 3))
    if target == 1:
        margin_top = margin_bottom = 11.43  # 0.45in
        margin_x = 13.97  # 0.55in
        base_factor = 1.15
    else:
        margin_top = margin_bottom = 12.7  # 0.5in
        margin_x = 15.24  # 0.6in
        base_factor = 1.18
    factor = base_factor + {"compact": -0.02, "standard": 0.0, "spacious": 0.05}[density]

    name_pt, heading_pt, body_pt, meta_pt = 18.0, 12.0, 10.0, 9.0
    recent_cap, older_cap, projects, summary_cap = _DENSITY_CAPS[density]

    return RenderConfig(
        page_target=target,
        density=density,
        margin_top_mm=margin_top,
        margin_bottom_mm=margin_bottom,
        margin_x_mm=margin_x,
        name_pt=name_pt,
        heading_pt=heading_pt,
        body_pt=body_pt,
        meta_pt=meta_pt,
        name_line_mm=round(name_pt * _PT_TO_MM * factor, 2),
        heading_line_mm=round(heading_pt * _PT_TO_MM * factor, 2),
        body_line_mm=round(body_pt * _PT_TO_MM * factor, 2),
        meta_line_mm=round(meta_pt * _PT_TO_MM * factor, 2),
        recent_bullet_cap=recent_cap,
        older_bullet_cap=older_cap,
        recent_entry_count=RECENT_ENTRY_COUNT,
        project_limit=projects,
        summary_cap=summary_cap,
    )
