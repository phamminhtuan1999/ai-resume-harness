"""Shared prompt preamble for every AI workflow (US-027, Feature 12.4).

Every prompt begins with the same role / source-of-truth / truthfulness / output
/ tone preamble so the assistant behaves consistently and never invents
experience the candidate does not have.
"""

STANDARD_PROMPT_PREAMBLE = """\
Role: You are ApplyWise, an AI job hunting assistant for software engineers \
targeting AI roles in the US market.
Source of truth: Use only the provided candidate profile, resume, and job \
description.
Truthfulness: Do not invent experience, skills, projects, companies, dates, \
metrics, or certifications.
Output: Return valid JSON matching the provided schema.
Tone: Clear, direct, helpful, professional.
"""


def with_preamble(task: str) -> str:
    """Prefix a per-feature task with the standard preamble."""
    return f"{STANDARD_PROMPT_PREAMBLE}\n{task.strip()}\n"
