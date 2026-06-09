from collections.abc import Callable
from typing import Any

import httpx

from app.settings import Settings

# Injectable POST seam so tests exercise the parsing/error logic with fixture
# payloads instead of real network calls.
HttpPost = Callable[..., httpx.Response]


class FirecrawlError(RuntimeError):
    """Base class for job-page fetch failures."""


class FirecrawlNotConfiguredError(FirecrawlError):
    """No Firecrawl API key configured. The UI falls back to manual paste."""


class FirecrawlFetchError(FirecrawlError):
    """Provider could not return readable content. UI falls back to manual paste."""


def scrape_job_page(
    *,
    url: str,
    settings: Settings,
    post: HttpPost | None = None,
) -> str:
    """Fetch a job page via Firecrawl and return its main-content markdown.

    The provider response is untrusted and only ``markdown`` is read. Raw fetched
    content is never logged. Raises ``FirecrawlNotConfiguredError`` when no key is
    set and ``FirecrawlFetchError`` for any provider/transport/empty-content
    failure, both of which the caller surfaces as the manual-paste fallback.
    """
    if not settings.firecrawl_api_key:
        raise FirecrawlNotConfiguredError("Firecrawl is not configured.")

    http_post = post or httpx.post
    endpoint = settings.firecrawl_api_base.rstrip("/") + "/v1/scrape"
    headers = {
        "Authorization": f"Bearer {settings.firecrawl_api_key}",
        "Content-Type": "application/json",
    }
    body = {"url": url, "formats": ["markdown"], "onlyMainContent": True}

    try:
        response = http_post(
            endpoint,
            headers=headers,
            json=body,
            timeout=settings.firecrawl_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise FirecrawlFetchError("Could not reach the fetch provider.") from exc

    if response.status_code >= 400:
        # Do not log response content. Surface a generic, status-only failure.
        raise FirecrawlFetchError(
            f"Fetch provider returned status {response.status_code}."
        )

    markdown = _extract_markdown(response.json())
    if not markdown.strip():
        raise FirecrawlFetchError("Fetched page had no readable content.")
    return markdown


def _extract_markdown(data: Any) -> str:
    if not isinstance(data, dict):
        return ""
    block = data.get("data") if isinstance(data.get("data"), dict) else data
    markdown = block.get("markdown") if isinstance(block, dict) else None
    return markdown if isinstance(markdown, str) else ""
