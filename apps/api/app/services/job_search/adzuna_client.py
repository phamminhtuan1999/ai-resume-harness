"""Adzuna job search provider client (US-073, decision 0025).

Injectable ``get`` seam so tests exercise the parse/error logic with fixture
payloads instead of live network calls. No Adzuna key is required for CI.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import httpx

from app.services.job_search.provider import (
    JobSearchNotConfiguredError,
    JobSearchProviderError,
    ProviderJob,
)

_MAX_DESCRIPTION_CHARS = 4_000
HttpGet = Callable[..., httpx.Response]


class AdzunaJobSearchProvider:
    def __init__(self, settings: Any, *, get: HttpGet | None = None) -> None:
        self._app_id = getattr(settings, "adzuna_app_id", "")
        self._app_key = getattr(settings, "adzuna_app_key", "")
        self._api_base = (getattr(settings, "adzuna_api_base", "") or "").rstrip("/")
        self._country = getattr(settings, "adzuna_search_country", "us") or "us"
        self._timeout = getattr(settings, "adzuna_timeout_seconds", 30)
        self._get = get or httpx.get

    def search(
        self,
        *,
        query: str,
        location: str,
        remote_only: bool,
        results_per_page: int,
    ) -> list[ProviderJob]:
        if not self._app_id or not self._app_key:
            raise JobSearchNotConfiguredError(
                "Adzuna credentials (ADZUNA_APP_ID / ADZUNA_APP_KEY) are not configured."
            )

        what, where = self._resolve_what_where(query, location, remote_only)
        params: dict[str, Any] = {
            "app_id": self._app_id,
            "app_key": self._app_key,
            "results_per_page": min(int(results_per_page), 50),
            "what": what,
            "where": where,
        }
        endpoint = f"{self._api_base}/jobs/{self._country}/search/1"

        try:
            response = self._get(endpoint, params=params, timeout=self._timeout)
        except httpx.HTTPError as exc:
            raise JobSearchProviderError("Could not reach Adzuna.") from exc

        if response.status_code >= 400:
            raise JobSearchProviderError(
                f"Adzuna returned status {response.status_code}."
            )

        return self._parse(response.json())

    @staticmethod
    def _resolve_what_where(query: str, location: str, remote_only: bool) -> tuple[str, str]:
        """Shape Adzuna's ``what``/``where`` from the search intent.

        Adzuna's ``where`` geocodes to a physical place, so any "remote" text —
        the ``remote_only`` flag *or* a location like "Remote US" (the default)
        — matches nothing and returns an empty result set. Such remote intent
        rides in the ``what`` keywords instead. A real location is preserved as
        ``where`` even for remote searches (remote roles in a region), and the
        country path already scopes the search, so a remote location string is
        simply dropped rather than geocoded.
        """
        query = (query or "").strip()
        location = (location or "").strip()
        location_signals_remote = "remote" in location.lower()
        is_remote = remote_only or location_signals_remote

        where = "" if location_signals_remote else location
        what = query
        if is_remote and "remote" not in query.lower():
            what = f"{query} remote".strip()
        return what, where

    def _parse(self, data: Any) -> list[ProviderJob]:
        if not isinstance(data, dict):
            return []
        jobs = []
        for item in data.get("results") or []:
            job = self._parse_item(item)
            if job:
                jobs.append(job)
        return jobs

    def _parse_item(self, item: Any) -> ProviderJob | None:
        if not isinstance(item, dict):
            return None
        job_id = str(item.get("id") or "").strip()
        title = str(item.get("title") or "").strip()
        if not job_id or not title:
            return None

        company: str | None = None
        company_block = item.get("company")
        if isinstance(company_block, dict):
            company = (company_block.get("display_name") or "").strip() or None

        location: str | None = None
        location_block = item.get("location")
        if isinstance(location_block, dict):
            location = (location_block.get("display_name") or "").strip() or None

        description = str(item.get("description") or "").strip()[:_MAX_DESCRIPTION_CHARS]
        apply_url = str(item.get("redirect_url") or "").strip() or None
        posted_at = str(item.get("created") or "").strip() or None

        return ProviderJob(
            external_id=job_id,
            external_source="adzuna",
            title=title,
            company=company,
            location=location,
            description=description,
            apply_url=apply_url,
            posted_at=posted_at,
            raw_payload=item,
        )
