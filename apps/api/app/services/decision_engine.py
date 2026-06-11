"""Deterministic job-analysis decision engine (US-047, Period 11).

Pure functions only — no I/O, no AI calls, no clock. Saved module outputs are
adapted into :class:`DecisionInputs` (see ``decision_adapters.py``) and this
module turns them into one decision label, material-readiness guardrails, a
prioritized next-action list, and a confidence explanation.

The direction is frozen in ``docs/decisions/0015-job-analysis-decision-engine.md``;
the load-bearing pieces reproduced here are §2 (the ordered rules + absent-input
defaults), §3 (the affinity heuristic), and §4 (the action-placement table). The
band constants, rule order, and reachability of every label/clause are asserted
by the US-047 unit matrix — keep this module pure so those tests stay fast.
"""

from __future__ import annotations

from dataclasses import dataclass

# --- Score bands (0015 §2, frozen) ----------------------------------------------

BAND_HIGH = 80
BAND_MID = 60
BAND_LOW = 35

# Bumped whenever the rules/bands above change so history can distinguish
# "the rules changed" from "your fit changed" (0015 §7 / US-054 marker).
RULES_VERSION = "p11.r1"

DecisionLabel = str  # strong_apply | apply_with_improvements | learning_target | not_recommended
TailoringSignal = str  # safe | unsafe | unknown
RiskLevel = str  # low | medium | high

DISPLAY_LABELS: dict[str, str] = {
    "strong_apply": "Strong Apply Target",
    "apply_with_improvements": "Apply With Improvements",
    "learning_target": "Learning Target",
    "not_recommended": "Not Recommended Yet",
}

# All nine confidence reason codes (0015 §2 / design.md ConfidenceExplanation).
CONFIDENCE_REASON_PHRASES: dict[str, str] = {
    "profile_incomplete": "your profile is missing some details",
    "no_target_role": "you haven't set a target role yet",
    "job_description_short": "the job description is very brief",
    "job_not_extracted": "the job posting wasn't fully read",
    "requirements_ambiguous": "the role's requirements are unclear",
    "deterministic_fallback": "AI assistance was unavailable, so a basic analysis was used",
    "module_failed": "part of the analysis didn't finish",
    "module_output_partial": "part of the analysis came back incomplete",
    "module_missing": "some analysis steps haven't run yet",
}


# --- Affinity / role families (0015 §3) -----------------------------------------
#
# The normative spec is the role-family fixture matrix shipped with the US-047
# tests; this token map is the implementation that passes it. A title belongs to
# every family whose tokens it contains (after seniority stripping). Two roles
# are directionally related when their family sets intersect.

_SENIORITY_TOKENS = frozenset(
    {
        "senior",
        "junior",
        "jr",
        "sr",
        "lead",
        "principal",
        "staff",
        "mid",
        "entry",
        "associate",
        "head",
        "chief",
        "intern",
    }
)

ROLE_FAMILIES: dict[str, frozenset[str]] = {
    "engineering": frozenset(
        {"engineer", "engineering", "developer", "dev", "programmer", "swe", "sde", "software"}
    ),
    "ai": frozenset(
        {"ai", "ml", "llm", "genai", "nlp", "machine", "learning", "scientist", "applied"}
    ),
    "data": frozenset({"data", "analytics", "analyst", "scientist", "bi"}),
    "frontend": frozenset({"frontend", "front-end", "react", "ui", "web", "client"}),
    "backend": frozenset({"backend", "back-end", "api", "server", "platform", "infrastructure"}),
    "devops": frozenset({"devops", "sre", "reliability", "infrastructure", "cloud", "platform"}),
    "mobile": frozenset({"mobile", "ios", "android", "flutter"}),
    "product": frozenset({"product", "pm"}),
    "design": frozenset({"design", "designer", "ux", "ui", "ux/ui"}),
    "qa": frozenset({"qa", "test", "testing", "quality", "sdet"}),
    "security": frozenset({"security", "appsec", "infosec"}),
}


def _tokenize_role(text: str) -> frozenset[str]:
    raw = (text or "").lower().replace("/", " ").replace("-", " ")
    tokens = {tok.strip() for tok in raw.split() if tok.strip()}
    return frozenset(tokens - _SENIORITY_TOKENS)


def role_families(text: str) -> frozenset[str]:
    """Return the set of role families a title/role string belongs to."""
    tokens = _tokenize_role(text)
    families = {name for name, fam in ROLE_FAMILIES.items() if tokens & fam}
    return frozenset(families)


# --- Value objects --------------------------------------------------------------


@dataclass(frozen=True)
class GapInput:
    """One missing/weak skill (US-029 ``missing_skills_json`` element)."""

    skill: str
    importance: str = "medium"  # critical | medium | nice_to_have
    gap_type: str = "true_gap"  # true_gap | wording_gap | proof_gap
    evidence_status: str = "no_evidence"  # no_evidence | weak_evidence | strong_evidence


@dataclass(frozen=True)
class DecisionInputs:
    """Everything the engine needs, already normalized from saved module rows.

    Absent-input defaults are the *contract* (0015 §2): risk defaults to
    ``medium``; tailoring is ``unknown`` until suggestions exist (only known
    ``unsafe`` blocks a label); confidence is the mean of available core-module
    confidences.
    """

    overall_score: int
    sub_scores: dict[str, int]
    gaps: tuple[GapInput, ...] = ()
    risk_level: str = "medium"
    tailoring_signal: str = "unknown"
    user_asserted_relevance: bool = False

    target_role: str = ""
    current_role: str = ""
    technical_background: str = ""
    job_title: str = ""
    job_url: str | None = None

    application_status: str | None = None
    has_roadmap: bool = False
    has_draft_cv: bool = False
    has_suggestions: bool = False

    # Confidence inputs (0-1 floats; None when the module is absent).
    match_confidence: float | None = None
    missing_skills_confidence: float | None = None
    insight_confidence: float | None = None

    # Confidence-reason signals (each maps to one code).
    profile_incomplete: bool = False
    job_description_short: bool = False
    job_not_extracted: bool = False
    requirements_ambiguous: bool = False
    module_output_partial: bool = False
    used_deterministic_fallback: bool = False
    failed_modules: tuple[str, ...] = ()
    missing_modules: tuple[str, ...] = ()


@dataclass(frozen=True)
class MaterialReadiness:
    draft_cv: str  # recommended | allowed_with_warning | not_recommended
    cover_letter: str
    reason: str


@dataclass(frozen=True)
class NextAction:
    type: str
    label: str
    priority: int
    reason: str
    placement: str  # primary | secondary | advanced
    state: str = "enabled"  # enabled | locked | done


@dataclass(frozen=True)
class ConfidenceExplanation:
    score: float | None
    reasons: tuple[str, ...]
    qualitative: str


@dataclass(frozen=True)
class DecisionResult:
    label: str
    display_label: str
    match_score: int
    risk_level: str
    summary: str
    reason_kind: str
    confidence: ConfidenceExplanation
    material_readiness: MaterialReadiness
    next_actions: tuple[NextAction, ...]
    is_directionally_relevant: bool


# --- Gap predicates (0015 §2) ----------------------------------------------------


def is_critical_gap(gap: GapInput) -> bool:
    """critical importance AND a true gap AND no resume evidence (0015 §2)."""
    return (
        gap.importance == "critical"
        and gap.gap_type == "true_gap"
        and gap.evidence_status == "no_evidence"
    )


def has_critical_gap(gaps: tuple[GapInput, ...]) -> bool:
    return any(is_critical_gap(g) for g in gaps)


def has_important_gap(gaps: tuple[GapInput, ...]) -> bool:
    """An "important gap" is any ``importance == 'medium'`` gap; ``nice_to_have``
    never affects the label (0015 §2)."""
    return any(g.importance == "medium" for g in gaps)


def critical_gap_skills(gaps: tuple[GapInput, ...]) -> list[str]:
    return [g.skill for g in gaps if is_critical_gap(g)]


# --- Affinity heuristic (0015 §3) -----------------------------------------------


def is_directionally_relevant(inputs: DecisionInputs) -> bool:
    """Gate ``learning_target`` vs ``not_recommended`` for weak scores.

    Signal order (0015 §3): (1) user-asserted relevance always wins; (2)
    role-family overlap vs target_role, falling back to current_role; (3)
    learnable-gap lean adjacent to the user's technical background. When no
    reference role is set, the role is treated as not relevant (and the caller
    emits ``no_target_role``).
    """
    # Signal 1 — the user, not the heuristic, owns their direction.
    if inputs.user_asserted_relevance:
        return True

    reference = inputs.target_role.strip() or inputs.current_role.strip()
    if not reference:
        return False

    job_families = role_families(inputs.job_title)
    if job_families & role_families(reference):
        return True

    # Signal 3 — learnable-gap lean. Only leans relevant when the role is
    # adjacent to the user's stated technical background AND the dominant gaps
    # are wording/proof rather than a wholesale domain switch.
    if _gaps_are_learnable(inputs.gaps) and (job_families & role_families(inputs.technical_background)):
        return True
    return False


def _gaps_are_learnable(gaps: tuple[GapInput, ...]) -> bool:
    if not gaps:
        return False
    if has_critical_gap(gaps):
        return False
    learnable = sum(1 for g in gaps if g.gap_type in ("wording_gap", "proof_gap"))
    return learnable >= max(1, len(gaps) - learnable)


# --- Classification: ordered rules, first match wins (0015 §2) -------------------


def _classify(
    inputs: DecisionInputs, *, relevant: bool, crit: bool, imp: bool
) -> tuple[DecisionLabel, str]:
    """Return ``(label, reason_kind)``. ``reason_kind`` drives the summary copy
    and the material-readiness cap. Rules are evaluated top to bottom; the first
    match wins (0015 §2)."""
    score = inputs.overall_score
    risk = inputs.risk_level
    tailoring = inputs.tailoring_signal

    # Rule 1 — unsafe-to-claim guard (beats score).
    if tailoring == "unsafe":
        return "not_recommended", "unsafe_tailoring"
    if crit and risk == "high":
        return "not_recommended", "critical_high_risk"

    # Rule 2 — below the floor.
    if score < BAND_LOW:
        return "not_recommended", "below_floor"

    # Rule 3 — the learning band (35–59).
    if score < BAND_MID:
        if relevant:
            return "learning_target", "learning_relevant"
        return "not_recommended", "not_relevant"

    # Rule 4 — score wins at 60+ even with a critical gap (restatement #14): name
    # the gap and warn at generation time instead of gatekeeping.
    if crit:
        return "apply_with_improvements", "critical_gap_apply"

    # Rule 5 — strong apply carved out of >= 80.
    if score >= BAND_HIGH and not imp and risk in ("low", "medium"):
        return "strong_apply", "strong"

    # Rule 6 — everything else at 60+. Important gaps name the gap; a gap-free
    # high-risk firing must carry a risk-based reason, never gap copy (#15).
    if imp:
        return "apply_with_improvements", "important_gap_apply"
    if risk == "high":
        return "apply_with_improvements", "high_risk_alone"
    return "apply_with_improvements", "mid_band_apply"


# --- Summary copy (assistant voice; no module/provider/debug vocabulary) --------


def _build_summary(inputs: DecisionInputs, reason_kind: str) -> str:
    crit_skills = critical_gap_skills(inputs.gaps)
    first_gap = crit_skills[0] if crit_skills else ""
    role = inputs.target_role.strip() or inputs.current_role.strip()

    if reason_kind == "unsafe_tailoring":
        return (
            "Hold off — the tailoring suggestions for this role aren't supported by "
            "your resume yet, so applying now risks overstating your experience."
        )
    if reason_kind == "critical_high_risk":
        skill = f" ({first_gap})" if first_gap else ""
        return (
            f"This role has a required skill you can't yet back up{skill} and a high "
            "application risk, so it's not recommended just yet."
        )
    if reason_kind == "below_floor":
        return "This role is a weak fit right now — the core requirements don't line up with your background."
    if reason_kind == "learning_relevant":
        toward = f" toward {role}" if role else ""
        return (
            f"This isn't an apply-now match, but it's a solid learning target{toward}: "
            "close the key gaps and it becomes reachable."
        )
    if reason_kind == "not_relevant":
        return (
            "This role is a weak fit and isn't on your stated path, so it's better to "
            "focus your energy on closer matches."
        )
    if reason_kind == "critical_gap_apply":
        skill = first_gap or "a key required skill"
        return (
            f"You're a strong scorer here, but {skill} is a required skill your resume "
            "doesn't yet evidence — name it honestly and apply with improvements."
        )
    if reason_kind == "strong":
        return "Strong match — your experience lines up well with what this role needs. Lead with your strengths and apply."
    if reason_kind == "high_risk_alone":
        return (
            "Your skills match well, but this application carries some risk — apply "
            "with a tailored, carefully framed resume."
        )
    if reason_kind == "important_gap_apply":
        return (
            "A good match with a few gaps to address — tailor your resume to the role's "
            "priorities and apply with improvements."
        )
    # mid_band_apply
    return "A reasonable match — a few targeted improvements to your resume will strengthen this application."


# --- Material readiness (0015 §4 / design.md) -----------------------------------


def _material_readiness(inputs: DecisionInputs, label: str) -> MaterialReadiness:
    if inputs.tailoring_signal == "unsafe":
        return MaterialReadiness(
            "not_recommended",
            "not_recommended",
            "Tailoring isn't safe yet — the suggested edits aren't supported by your resume.",
        )
    if label == "strong_apply":
        return MaterialReadiness(
            "recommended",
            "recommended",
            "Strong match — your materials can lead with real, evidenced strengths.",
        )
    if label == "apply_with_improvements":
        # The rule-4 cap is observable from the inputs (a critical gap at 60+),
        # so the read path renders it without recomputing reason_kind.
        if has_critical_gap(inputs.gaps):
            skills = critical_gap_skills(inputs.gaps)
            named = skills[0] if skills else "a required skill"
            return MaterialReadiness(
                "allowed_with_warning",
                "allowed_with_warning",
                f"You can generate materials, but they can't claim {named} — keep it honest.",
            )
        if inputs.has_suggestions:
            return MaterialReadiness(
                "recommended",
                "recommended",
                "Your resume strategy is ready — generate tailored materials.",
            )
        return MaterialReadiness(
            "allowed_with_warning",
            "allowed_with_warning",
            "Review your resume strategy first so your materials stay grounded.",
        )
    # learning_target / not_recommended — the Generate-Anyway path (brief Epic 10).
    return MaterialReadiness(
        "allowed_with_warning",
        "allowed_with_warning",
        "You can still generate materials, but this role is a stretch — they'll be framed accordingly.",
    )


# --- Next actions (0015 §4 normative placement table) ---------------------------

_TRACKER_LIVE = ("applied", "interviewing", "offer")

# Human labels + routes for every action type. Routes target existing surfaces.
_ACTION_LABELS: dict[str, str] = {
    "generate_draft_cv": "Generate Draft CV",
    "generate_cover_letter": "Generate Cover Letter",
    "prepare_interview": "Prepare Interview",
    "save_to_tracker": "Save to Tracker",
    "open_apply_link": "Open Apply Link",
    "view_skill_gaps": "View Skill Gaps",
    "review_skill_gaps": "Review Skill Gaps",
    "review_resume_strategy": "Review Resume Strategy",
    "generate_resume_suggestions": "Generate Resume Suggestions",
    "generate_roadmap": "Generate 4-Week Roadmap",
    "save_learning_target": "Save as Learning Target",
    "update_profile": "Update Professional Profile",
    "find_better_matches": "Review your other saved jobs",
    "save_reference": "Keep for reference",
    "generate_materials_anyway": "Generate Materials Anyway",
    "view_analysis_details": "View Analysis Details",
}

# Base placement per label, in display order within each tier. The agency
# actions that 0015 §4 requires for *every* label are injected afterward if a
# label omits them (e.g. strong_apply's roadmap / learning-target save).
_PLACEMENT_TABLE: dict[str, dict[str, list[str]]] = {
    "strong_apply": {
        "primary": ["generate_draft_cv"],
        "secondary": [
            "generate_cover_letter",
            "prepare_interview",
            "save_to_tracker",
            "open_apply_link",
            "view_skill_gaps",
        ],
        "advanced": ["view_analysis_details"],
    },
    "apply_with_improvements": {
        "primary": [
            "review_resume_strategy",
            "generate_resume_suggestions",
            "generate_draft_cv",
        ],
        "secondary": [
            "review_skill_gaps",
            "generate_cover_letter",
            "prepare_interview",
            "save_to_tracker",
            "open_apply_link",
        ],
        "advanced": ["view_analysis_details"],
    },
    "learning_target": {
        "primary": ["generate_roadmap"],
        "secondary": [
            "save_learning_target",
            "update_profile",
            "prepare_interview",
            "find_better_matches",
            "view_skill_gaps",
        ],
        "advanced": [
            "generate_materials_anyway",
            "save_to_tracker",
            "open_apply_link",
            "view_analysis_details",
        ],
    },
    "not_recommended": {
        "primary": ["find_better_matches", "save_reference"],
        "secondary": [
            "view_skill_gaps",
            "generate_roadmap",
            "save_learning_target",
            "update_profile",
            "prepare_interview",
        ],
        "advanced": [
            "generate_materials_anyway",
            "save_to_tracker",
            "open_apply_link",
            "view_analysis_details",
        ],
    },
}

# Emitted for every label — tier varies, absence does not (0015 §4 / #18).
_AGENCY_ACTIONS = (
    "open_apply_link",
    "save_to_tracker",
    "save_learning_target",
    "generate_roadmap",
    "prepare_interview",
)

_PLACEMENT_RANK = {"primary": 0, "secondary": 10, "advanced": 20}


def _action_reason(action_type: str) -> str:
    reasons = {
        "generate_draft_cv": "Build an ATS-safe tailored CV for this role.",
        "generate_cover_letter": "Draft a cover letter grounded in your real experience.",
        "prepare_interview": "Get ready for interview questions this role is likely to ask.",
        "save_to_tracker": "Keep this job in your application tracker.",
        "open_apply_link": "Go to the original job posting to apply.",
        "view_skill_gaps": "See exactly which skills the role needs.",
        "review_skill_gaps": "Review the gaps to address before applying.",
        "review_resume_strategy": "See how to position your resume for this role.",
        "generate_resume_suggestions": "Get safe, evidence-backed resume edits.",
        "generate_roadmap": "Get a 4-week plan to close the key gaps.",
        "save_learning_target": "Track this as a role you're building toward.",
        "update_profile": "Add missing profile details so the analysis improves.",
        "find_better_matches": "Spend your effort on jobs that fit better right now.",
        "save_reference": "Keep this for reference without treating it as active.",
        "generate_materials_anyway": "Generate materials anyway — they'll be framed as a stretch.",
        "view_analysis_details": "Open the full technical analysis.",
    }
    return reasons.get(action_type, "")


def _build_next_actions(inputs: DecisionInputs, label: str) -> tuple[NextAction, ...]:
    table = {tier: list(actions) for tier, actions in _PLACEMENT_TABLE[label].items()}

    # Agency actions are never absent — inject any missing ones into Advanced.
    present = {a for actions in table.values() for a in actions}
    for agency in _AGENCY_ACTIONS:
        if agency not in present:
            table["advanced"].append(agency)
            present.add(agency)

    # Tracker-state overrides framing (0015 §4): a live application never gets
    # told to shop around, and Prepare Interview is promoted to Primary.
    live_application = (inputs.application_status or "") in _TRACKER_LIVE
    if live_application:
        for tier in table:
            table[tier] = [a for a in table[tier] if a not in ("find_better_matches", "save_reference")]
        for tier in ("secondary", "advanced"):
            if "prepare_interview" in table[tier]:
                table[tier].remove("prepare_interview")
        if "prepare_interview" not in table["primary"]:
            table["primary"].insert(0, "prepare_interview")

    # Promote Update Profile toward Primary when the profile is the blocker.
    profile_is_blocker = inputs.profile_incomplete or not (
        inputs.target_role.strip() or inputs.current_role.strip()
    )
    if profile_is_blocker and label in ("learning_target", "not_recommended"):
        for tier in ("secondary", "advanced"):
            if "update_profile" in table[tier]:
                table[tier].remove("update_profile")
                table["primary"].append("update_profile")
                break

    actions: list[NextAction] = []
    for tier, action_types in table.items():
        for index, action_type in enumerate(action_types):
            # Open Apply Link only exists when there is a URL to open.
            if action_type == "open_apply_link" and not inputs.job_url:
                continue

            state = "enabled"
            this_label = _ACTION_LABELS[action_type]

            # Draft CV stays in Primary for apply_with_improvements but is locked
            # with an inline reason until a strategy exists — stable geography,
            # state flips (0015 §4). Score-wins critical-gap matches keep the lock.
            if (
                action_type == "generate_draft_cv"
                and label == "apply_with_improvements"
                and not inputs.has_suggestions
            ):
                state = "locked"

            # Satisfied generate-actions flip to view-actions ("done").
            if action_type == "generate_roadmap" and inputs.has_roadmap:
                state = "done"
                this_label = "View 4-Week Roadmap"
            if action_type == "generate_draft_cv" and inputs.has_draft_cv and state != "locked":
                state = "done"
                this_label = "View Draft CV"

            reason = _action_reason(action_type)
            if state == "locked" and action_type == "generate_draft_cv":
                reason = "Review your resume strategy first."

            actions.append(
                NextAction(
                    type=action_type,
                    label=this_label,
                    priority=_PLACEMENT_RANK[tier] + index,
                    reason=reason,
                    placement=tier,
                    state=state,
                )
            )
    return tuple(actions)


# --- Confidence (0015 §2 / §11) --------------------------------------------------


def _confidence(inputs: DecisionInputs) -> ConfidenceExplanation:
    available = [
        c
        for c in (inputs.match_confidence, inputs.missing_skills_confidence, inputs.insight_confidence)
        if c is not None
    ]
    score = round(sum(available) / len(available), 4) if available else None

    reasons: list[str] = []
    if inputs.profile_incomplete:
        reasons.append("profile_incomplete")
    if not (inputs.target_role.strip() or inputs.current_role.strip()):
        reasons.append("no_target_role")
    if inputs.job_description_short:
        reasons.append("job_description_short")
    if inputs.job_not_extracted:
        reasons.append("job_not_extracted")
    if inputs.requirements_ambiguous:
        reasons.append("requirements_ambiguous")
    if inputs.used_deterministic_fallback:
        reasons.append("deterministic_fallback")
    if inputs.failed_modules:
        reasons.append("module_failed")
    if inputs.module_output_partial:
        reasons.append("module_output_partial")
    if inputs.missing_modules:
        reasons.append("module_missing")

    qualitative = qualitative_confidence(score, tuple(reasons))
    return ConfidenceExplanation(score=score, reasons=tuple(reasons), qualitative=qualitative)


def qualitative_confidence(score: float | None, reasons: tuple[str, ...]) -> str:
    """Plain-language confidence for the header — never two numbers (0015 §11)."""
    if reasons:
        phrases = [CONFIDENCE_REASON_PHRASES[r] for r in reasons if r in CONFIDENCE_REASON_PHRASES]
        lead = "Limited analysis" if (score is None or score < 0.75) else "Good analysis, with caveats"
        if phrases:
            return f"{lead} — {_join_phrases(phrases)}."
        return f"{lead}."
    if score is None:
        return "Not analyzed yet."
    if score >= 0.75:
        return "High confidence — the analysis used your full profile and the job details."
    if score >= 0.5:
        return "Moderate confidence in this assessment."
    return "Limited confidence — treat this as a rough read."


def _join_phrases(phrases: list[str]) -> str:
    if len(phrases) == 1:
        return phrases[0]
    if len(phrases) == 2:
        return f"{phrases[0]} and {phrases[1]}"
    return f"{', '.join(phrases[:-1])}, and {phrases[-1]}"


# --- Public entry point ----------------------------------------------------------


def decide(inputs: DecisionInputs) -> DecisionResult:
    """Run the full engine: label, summary, readiness, actions, confidence.

    Pure and deterministic — identical inputs always yield an identical result.
    """
    relevant = is_directionally_relevant(inputs)
    crit = has_critical_gap(inputs.gaps)
    imp = has_important_gap(inputs.gaps)

    label, reason_kind = _classify(inputs, relevant=relevant, crit=crit, imp=imp)
    summary = _build_summary(inputs, reason_kind)
    readiness = _material_readiness(inputs, label)
    actions = _build_next_actions(inputs, label)
    confidence = _confidence(inputs)

    return DecisionResult(
        label=label,
        display_label=DISPLAY_LABELS[label],
        match_score=inputs.overall_score,
        risk_level=inputs.risk_level,
        summary=summary,
        reason_kind=reason_kind,
        confidence=confidence,
        material_readiness=readiness,
        next_actions=actions,
        is_directionally_relevant=relevant,
    )


def build_presentation(
    inputs: DecisionInputs, label: str
) -> tuple[MaterialReadiness, tuple[NextAction, ...]]:
    """Render material readiness + next actions for a *given* label.

    The read path (``GET /analysis-package``) serves the stored snapshot's label
    (stable verdict; staleness is surfaced separately, 0015 §7) but recomputes
    the volatile presentation — readiness and actions — from current inputs.
    Both ``decide`` and this helper share the same builders, so a served snapshot
    and a fresh recompute of the same label render identically.
    """
    return _material_readiness(inputs, label), _build_next_actions(inputs, label)


__all__ = [
    "BAND_HIGH",
    "BAND_MID",
    "BAND_LOW",
    "RULES_VERSION",
    "DISPLAY_LABELS",
    "ROLE_FAMILIES",
    "GapInput",
    "DecisionInputs",
    "MaterialReadiness",
    "NextAction",
    "ConfidenceExplanation",
    "DecisionResult",
    "role_families",
    "is_critical_gap",
    "has_critical_gap",
    "has_important_gap",
    "critical_gap_skills",
    "is_directionally_relevant",
    "decide",
    "build_presentation",
    "qualitative_confidence",
]
