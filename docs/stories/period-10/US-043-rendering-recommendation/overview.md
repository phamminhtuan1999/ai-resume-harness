# Overview

## Status

planned

## Current Behavior

Draft CV generation (US-039) produces truth-guarded `cv_json` with no notion
of document length or appearance. The renderer hardcodes one layout; nothing
recommends a page count, nothing tells the model how concisely to write, and
`draft_cvs` has no rendering metadata. `user_profiles.years_of_experience`
exists but is unused by this workflow.

## Target Behavior

Generation computes a **deterministic server page policy** before the prompt
(`page_policy.py`, pure functions): years of experience from the
`user_profiles.years_of_experience` column, falling back to a conservative
span-parse of profile work-history dates, else a default band (target 1,
max 2) with a `yoe_unknown` note. Bands follow the brief
(0–2 → 1/1; 3–7 → 1 with 2 allowed at ≥5 y or on the evidence-volume trigger;
8–12 → 1–2 preferring 2 on senior/staff signals; 12+ → 2 with 3 allowed only
behind the exceptional gate: title keywords principal/staff/distinguished/
research or profile publication/patent markers). Job seniority is optional
enrichment from `jobs.structured_json` + title keywords.

The model's output gains a `rendering_recommendation` object
(`recommended_page_count`, `page_count_reason`, `font_profile`,
`layout_density`, `compression_strategy[]`); the prompt states the policy and
the target so the model words bullets to fit. The server **clamps**
`recommended_page_count` into the policy's allowed range (`policy_clamped`
quality note on disagreement); reason/density/strategy strings are
display-only. The deterministic fallback emits the policy target with a
templated reason. The result is stored in a new nullable
`draft_cvs.rendering_json` column (migration `0019`, additive): clamped
recommendation + policy snapshot + the model's pre-clamp values. Existing
reads return it automatically; pre-0019 rows stay null (legacy rendering).

## Affected Users

- Software engineers exporting a draft CV: the document length now matches
  experience-level expectations, and the reasoning is visible (US-046).
- US-044/US-045 consume `rendering_json.font_profile` and the page target.

## Affected Product Docs

- `docs/product/data-model.md` (`draft_cvs.rendering_json`)
- `docs/product/ai-workflows.md` (Draft CV Generator: recommendation + policy)
- `docs/decisions/0014-draft-cv-rendering-rework.md` (direction, §1/§6)
- `docs/stories/period-10/README.md` (restatements #1, #2, #14)

## Non-Goals

- Any rendering change (US-044 fonts, US-045 layout/compression, US-046 UI).
- Enforcing the page count at export (US-045 owns the measure loop).
- A user-facing font picker (out of scope for the period).
- Backfilling rendering_json for existing rows (legacy rows keep legacy
  rendering until regenerated).
