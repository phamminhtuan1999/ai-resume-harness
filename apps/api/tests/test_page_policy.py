"""US-043 page-policy tests: bands + boundaries, mechanical proxies, the
work-history parse fallback, clamping, and snapshot round-trips.

Pure functions only — ``now_year`` is injected so results are reproducible.
"""

from __future__ import annotations

import pytest

from app.services.export.page_policy import (
    clamp_page_count,
    compute_page_policy,
    policy_from_dict,
)

NOW = 2026


def _policy(yoe=None, profile=None, **kwargs):
    return compute_page_policy(
        years_of_experience=yoe,
        candidate_profile=profile if profile is not None else {},
        now_year=NOW,
        **kwargs,
    )


def _voluminous_profile() -> dict:
    """Trips the evidence-volume trigger (>= 18 bullets)."""
    return {
        "work_experience": [
            {"title": "Engineer", "bullet_points": [f"Did thing {i}" for i in range(10)]},
            {"title": "Engineer", "bullet_points": [f"Did thing {i}" for i in range(10)]},
        ]
    }


# --- band matrix -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("yoe", "target", "max_pages"),
    [
        (0, 1, 1),
        (2, 1, 1),
        (2.9, 1, 1),
        (3, 1, 1),  # 3-7 band below 5y without the evidence trigger
        (4.9, 1, 1),
        (5, 1, 2),  # SE default: 2 allowed at >= 5y
        (7.9, 1, 2),
        (8, 1, 2),  # 8-12 band without seniority/evidence -> prefer 1
        (11.9, 1, 2),
        (12, 2, 2),  # 12+ plain: 2 pages, no 3rd without the gate
        (20, 2, 2),
    ],
)
def test_band_matrix(yoe: float, target: int, max_pages: int) -> None:
    policy = _policy(yoe=yoe)
    assert (policy.target_pages, policy.max_pages) == (target, max_pages)
    assert policy.yoe_source == "profile"
    assert "year" in policy.basis


def test_unknown_yoe_defaults_with_note() -> None:
    policy = _policy(yoe=None, profile={})
    assert (policy.target_pages, policy.max_pages) == (1, 2)
    assert policy.yoe_source == "unknown"
    assert "yoe_unknown" in policy.notes
    assert policy.basis == "experience level unknown"


# --- mechanical proxies --------------------------------------------------------------


def test_evidence_volume_trigger_allows_two_pages_in_3_7_band() -> None:
    assert _policy(yoe=3, profile=_voluminous_profile()).max_pages == 2
    # Entry-count variant of the trigger.
    four_entries = {
        "work_experience": [{"title": "E", "bullet_points": ["a"]} for _ in range(4)]
    }
    assert _policy(yoe=3, profile=four_entries).max_pages == 2


def test_seniority_signal_prefers_two_pages_in_8_12_band() -> None:
    assert _policy(yoe=9, job_title="Staff Engineer, Platform").target_pages == 2
    assert _policy(yoe=9, current_role="Senior Software Engineer").target_pages == 2
    assert _policy(yoe=9, job_structured={"seniority": "senior"}).target_pages == 2
    assert _policy(yoe=9, job_title="Software Engineer").target_pages == 1


def test_seniority_signal_does_not_change_lower_bands() -> None:
    policy = _policy(yoe=4, job_title="Staff Engineer")
    assert (policy.target_pages, policy.max_pages) == (1, 1)


def test_exceptional_gate_only_at_12_plus() -> None:
    assert _policy(yoe=13, job_title="Principal Engineer").max_pages == 3
    assert _policy(yoe=13, profile={"publications": ["paper"]}).max_pages == 3
    assert _policy(yoe=13, profile={"patents": ["US123"]}).max_pages == 3
    # Same signals below 12y never unlock a third page.
    assert _policy(yoe=9, job_title="Principal Engineer").max_pages == 2
    assert not _policy(yoe=9, job_title="Principal Engineer").exceptional
    # 12+ without any gate signal stays at 2.
    plain = _policy(yoe=13, job_title="Software Engineer")
    assert plain.max_pages == 2 and not plain.exceptional


# --- yoe fallback parse --------------------------------------------------------------


def test_yoe_parsed_from_work_history_dates() -> None:
    profile = {
        "work_experience": [
            {"start_date": "Oct 2022", "end_date": "Present", "bullet_points": []},
            {"start_date": "2019", "end_date": "2021", "bullet_points": []},
        ]
    }
    policy = _policy(yoe=None, profile=profile)
    assert policy.yoe == float(NOW - 2019)
    assert policy.yoe_source == "parsed_work_history"
    assert "estimated from work history" in policy.basis
    assert "yoe_unknown" not in policy.notes


def test_unparseable_dates_fall_back_to_unknown() -> None:
    profile = {
        "work_experience": [
            {"start_date": "October", "end_date": "a while", "bullet_points": []}
        ]
    }
    policy = _policy(yoe=None, profile=profile)
    assert policy.yoe is None
    assert policy.yoe_source == "unknown"
    assert "yoe_unknown" in policy.notes


def test_profile_column_wins_over_parseable_history() -> None:
    profile = {"work_experience": [{"start_date": "2000", "end_date": "2026"}]}
    policy = _policy(yoe=4, profile=profile)
    assert policy.yoe == 4.0
    assert policy.yoe_source == "profile"


# --- clamp + snapshot ----------------------------------------------------------------


def test_clamp_page_count() -> None:
    policy = _policy(yoe=4)  # max 1
    assert clamp_page_count(3, policy) == (1, True)
    assert clamp_page_count(1, policy) == (1, False)
    wide = _policy(yoe=13, job_title="Principal Engineer")  # max 3
    assert clamp_page_count(2, wide) == (2, False)
    assert clamp_page_count(0, wide) == (1, True)


def test_policy_snapshot_round_trip() -> None:
    policy = _policy(yoe=9, job_title="Staff Engineer", profile=_voluminous_profile())
    assert policy_from_dict(policy.as_dict()) == policy
    assert policy_from_dict(None) is None
    assert policy_from_dict({"max_pages": "junk"}) is None


def test_policy_is_deterministic() -> None:
    a = _policy(yoe=6, profile=_voluminous_profile(), job_title="Senior AI Engineer")
    b = _policy(yoe=6, profile=_voluminous_profile(), job_title="Senior AI Engineer")
    assert a == b
