"""Render options for Draft CV exports (US-044/US-045, Period 10).

Built by the router from a stored row's ``rendering_json`` (+ the user's
``pages`` override) and passed to both renderers. Options are ephemeral
render parameters — never persisted (decision 0014 §5). ``page_target=None``
means no page targeting: the pre-Period-10 (legacy) behavior.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.export.fonts import DEFAULT_FONT_PROFILE

DEFAULT_DENSITY = "standard"


@dataclass(frozen=True)
class RenderOptions:
    font_profile: str = DEFAULT_FONT_PROFILE
    page_target: int | None = None
    density: str = DEFAULT_DENSITY
    prioritized_keywords: tuple[str, ...] = ()
