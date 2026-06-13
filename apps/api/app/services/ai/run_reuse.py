"""Version-keyed AI run reuse (US-067, Period 15).

A workflow run is reusable when the inputs, the prompt version, and the resolved
model all match the latest completed run for the same subject. This module
computes the redaction-safe identity hash and holds the reuse decision, so
``BaseAIWorkflow`` stays focused on the run lifecycle.

The identity hash follows ``analysis_package._compute_inputs_hash``: only row
ids and ``updated_at`` timestamps (plus the prompt version, hashed in by the
caller via ``prompt_version``) ever enter the hash — never resume/profile/job
text. Raw content therefore never reaches a hash, a log, or a stored column.
"""

from __future__ import annotations

import hashlib
from typing import Any

# Statuses whose persisted output is safe to serve again.
_REUSABLE_STATUSES = ("completed", "needs_review")


def compute_identity_hash(identity: dict[str, Any] | None) -> str | None:
    """Stable sha256 over an input identity, or ``None`` when reuse is disabled.

    ``identity`` is a mapping of input key -> a JSON-ish value built only from
    row ids and ``updated_at`` stamps (the workflow's ``reuse_identity`` hook).
    A ``None`` identity means the workflow does not participate in reuse, so no
    hash is produced and the run always calls the provider.
    """
    if identity is None:
        return None
    parts = [f"{key}:{identity[key]}" for key in sorted(identity)]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def is_reusable(
    prior: dict[str, Any] | None,
    *,
    input_hash: str | None,
    prompt_version: str,
    model_name: str,
) -> bool:
    """True when ``prior`` (the latest run for this subject+type) can be served
    again for a request with the given hash/version/model.

    A reuse requires all four to line up:
    - the prior run succeeded (completed / needs_review),
    - the current inputs produced a hash at all (``input_hash`` is not None),
    - the prior run recorded the same ``input_hash`` (null hashes on historical
      rows therefore never match — the release guard),
    - the same ``prompt_version`` and the same resolved ``model_name``.
    """
    if prior is None or input_hash is None:
        return False
    if prior.get("status") not in _REUSABLE_STATUSES:
        return False
    return (
        prior.get("input_hash") == input_hash
        and prior.get("prompt_version") == prompt_version
        and prior.get("model_name") == model_name
    )
