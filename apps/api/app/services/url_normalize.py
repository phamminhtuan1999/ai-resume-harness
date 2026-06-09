from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


class InvalidJobUrlError(ValueError):
    """Submitted job URL is empty, malformed, or not http(s)."""


# Query keys that identify a campaign/click, not the job posting. Stripped so
# the same posting shared with different tracking does not dedupe as distinct.
_TRACKING_PREFIXES = ("utm_",)
_TRACKING_KEYS = {
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
    "_hsenc",
    "_hsmi",
    "igshid",
}


def validate_and_normalize_url(raw: str) -> tuple[str, str]:
    """Validate a job URL and return ``(source_url, normalized_url)``.

    ``source_url`` is the user's URL, trimmed and stripped of any fragment.
    ``normalized_url`` is a stable duplicate-detection key: scheme folded to
    https, host lowercased, default port dropped, tracking params removed,
    remaining query sorted, and no trailing slash. Raises ``InvalidJobUrlError``
    when the input cannot be a real http(s) page.
    """
    candidate = (raw or "").strip()
    if not candidate:
        raise InvalidJobUrlError("Enter a job URL.")
    if "://" not in candidate:
        candidate = "https://" + candidate

    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https"):
        raise InvalidJobUrlError("Job URL must start with http or https.")

    host = (parsed.hostname or "").lower()
    if not host or "." not in host:
        raise InvalidJobUrlError("Enter a valid job URL.")

    source_url = urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, "")
    )

    netloc = host
    if parsed.port and not (
        (parsed.scheme == "http" and parsed.port == 80)
        or (parsed.scheme == "https" and parsed.port == 443)
    ):
        netloc = f"{host}:{parsed.port}"

    path = parsed.path.rstrip("/") or "/"
    query_pairs = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=False)
        if not key.lower().startswith(_TRACKING_PREFIXES)
        and key.lower() not in _TRACKING_KEYS
    ]
    query_pairs.sort()
    normalized = urlunparse(("https", netloc, path, "", urlencode(query_pairs), ""))
    return source_url, normalized


def fallback_company_from_url(normalized_url: str) -> str:
    """Best-effort company label from a host when extraction finds no company.

    ``careers.acme.com`` -> ``Acme``; ``boards.greenhouse.io`` -> ``Greenhouse``.
    Only used as a last resort so a saved job always has a non-empty company.
    """
    host = (urlparse(normalized_url).hostname or "").lower()
    labels = [label for label in host.split(".") if label]
    if len(labels) >= 2:
        # Skip common subdomain prefixes, then take the registrable label.
        prefixes = {"www", "careers", "jobs", "job", "boards", "apply", "hire"}
        while len(labels) > 2 and labels[0] in prefixes:
            labels = labels[1:]
        candidate = labels[-2]
    elif labels:
        candidate = labels[0]
    else:
        return "Unknown company"
    return candidate.replace("-", " ").title() or "Unknown company"
