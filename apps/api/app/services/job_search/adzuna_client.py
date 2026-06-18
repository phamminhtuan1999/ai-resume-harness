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
        page: int = 1,
    ) -> list[ProviderJob]:
        if not self._app_id or not self._app_key:
            raise JobSearchNotConfiguredError(
                "Adzuna credentials (ADZUNA_APP_ID / ADZUNA_APP_KEY) are not configured."
            )

        # Adzuna's `where` geocodes to a physical place, so a literal "Remote"
        # matches nothing and the search comes back empty. Fold the remote intent
        # into the `what` keywords instead and clear `where` (remote roles aren't
        # tied to a city); the country path already scopes the search.
        what = query
        where = location
        if remote_only:
            where = ""
            if "remote" not in query.lower():
                what = f"{query} remote".strip()

        params: dict[str, Any] = {
            "app_id": self._app_id,
            "app_key": self._app_key,
            "results_per_page": min(int(results_per_page), 50),
            "what": what,
            "where": where,
        }
        safe_page = max(int(page), 1)
        endpoint = f"{self._api_base}/jobs/{self._country}/search/{safe_page}"

        try:
            response = self._get(endpoint, params=params, timeout=self._timeout)
        except httpx.HTTPError as exc:
            raise JobSearchProviderError("Could not reach Adzuna.") from exc

        if response.status_code >= 400:
            raise JobSearchProviderError(
                f"Adzuna returned status {response.status_code}."
            )

        return self._parse(response.json())

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
        salary_range = _format_salary(item)

        return ProviderJob(
            external_id=job_id,
            external_source="adzuna",
            title=title,
            company=company,
            location=location,
            description=description,
            apply_url=apply_url,
            posted_at=posted_at,
            salary_range=salary_range,
            raw_payload=item,
        )


def _format_salary(item: dict[str, Any]) -> str | None:
    """Format Adzuna's annual salary min/max into a display string, or None.

    Adzuna does not return a currency code on the basic salary fields — it is
    implied by the country endpoint (US default → USD), so we format as USD.
    Predicted (estimated) salaries are flagged so we never present a guess as a
    posted figure (Truth Guard).
    """

    def _amount(value: Any) -> int | None:
        return int(value) if isinstance(value, (int, float)) and value > 0 else None

    low = _amount(item.get("salary_min"))
    high = _amount(item.get("salary_max"))
    if low is None and high is None:
        return None

    if low and high and low != high:
        text = f"${low:,} – ${high:,}"
    else:
        text = f"${low or high:,}"

    if str(item.get("salary_is_predicted") or "").strip() == "1":
        text += " (est.)"
    return text
