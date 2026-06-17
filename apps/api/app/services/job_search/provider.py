"""JobSearchProvider interface, shared errors, and provider factory (US-073, decision 0025)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


class JobSearchNotConfiguredError(RuntimeError):
    """Provider credentials absent. The UI keeps Import URL / Paste JD fully usable."""


class JobSearchProviderError(RuntimeError):
    """Provider returned an error or is unreachable. The UI offers a retry."""


@dataclass
class ProviderJob:
    external_id: str
    external_source: str
    title: str
    company: str | None
    location: str | None
    description: str
    apply_url: str | None
    posted_at: str | None
    raw_payload: dict[str, Any] = field(default_factory=dict)


class JobSearchProvider(Protocol):
    def search(
        self,
        *,
        query: str,
        location: str,
        remote_only: bool,
        results_per_page: int,
    ) -> list[ProviderJob]: ...


def build_job_search_provider(settings: Any) -> JobSearchProvider:
    """Return the configured provider. Absence of keys is a state, not a crash.

    The returned provider raises ``JobSearchNotConfiguredError`` at search time
    when credentials are missing, keeping the 'not configured' path consistent
    regardless of which provider is selected.
    """
    provider_name = (getattr(settings, "job_search_provider", None) or "adzuna").lower()
    if provider_name == "adzuna":
        from app.services.job_search.adzuna_client import AdzunaJobSearchProvider

        return AdzunaJobSearchProvider(settings)
    raise ValueError(f"Unknown job search provider: {provider_name!r}")
