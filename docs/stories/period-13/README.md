# Period 13 — One Tailored CV, Two-Tier Feedback

## Goal

Periods 8–10 shipped two parallel "tailored resume" artifacts that share inputs
but not curation, three review surfaces with three different verbs, and an
invisible link between suggestion review and CV generation. The owner reports
the result is hard to use, and the Draft CV / generated resume pair conflict.

Period 13 consolidates on **one Tailored CV per match** driven by a **two-tier
feedback flow** presented as a visible stepper:

```
1 Suggest → 2 Respond (accept / edit / reject) → 3 Generate → 4 Final check → 5 Export
```

- **Tier 1 (before generation, the owner's target flow):** the user gives
  feedback on AI suggestions — accept, manually edit, or reject. Approved
  feedback shapes the one generation pass; user-edited feedback is
  **authoritative information** — meaning preserved, wording matched to the
  CV's tone, and shown side-by-side at final check so drift is rejectable.
- **Tier 2 (after generation):** bullets are editable in place; an edit is
  tone-polished (information parity) + evidence re-verified, the user
  confirms a word-diff (default polished; "keep my wording" available), and
  confirmed bullets **survive regeneration** (no regenerate lottery).

Guiding principle (decision 0019): **the user owns the information; the LLM
owns the tone; Truth Guard owns the truth.**

The Markdown resume draft is retired (it has no users); Markdown becomes an
export format of the Tailored CV. A deterministic coverage panel gives the
iterate signal; the cover letter is generated from the final CV.

Owner direction (2026-06-11): kill-not-merge; few/high-effort applications;
edits must be evidence re-checked; full redesign as Period 13, step by step;
flow amended to two-tier after explicit owner critique (Amendment I), and edit
semantics amended from verbatim to information-level feedback with LLM tone
ownership (Amendment II) — see decision 0019.

Intake: #47 (change-request, normal lane). Decision:
`docs/decisions/0019-single-tailored-cv.md` (amended 2026-06-11).

## Stories

| Story | Title | Phase | Status |
| --- | --- | --- | --- |
| US-059 | Retire the Markdown resume draft; Markdown export from the Tailored CV | 1 | implemented (2026-06-11) |
| US-061 | Tier-1 feedback step: suggestions stepper + tone-true weave + traceability | 2 | implemented (2026-06-11) |
| US-060 | Tier-2 final check: polish-and-confirm edits, re-verification, regenerate preservation | 3 | implemented (2026-06-11) |
| US-062 | Live keyword-coverage panel with delta | 4 | implemented (2026-06-11) |
| US-063 | Cover letter generated from the final Tailored CV | 4 | implemented (2026-06-11) |

Phases ship independently and in order (note: US-061 precedes US-060 — story
ids keep their registered numbers; the phase column is the execution order).

## Scope Summary

- `draft_cvs` is the single artifact; `resume_versions` goes dormant (no drop
  migration this period). `ResumeDraftWorkflow` + `tailored-resume` segment +
  resume-draft page retire; the workflow is NOT in the orchestrator manifest.
- The suggestions page is **elevated, not retired**: it becomes the official
  tier-1 feedback step, with `ai_suggested` vs `user_edited` provenance and an
  explicit "N approved responses shape this CV" link to generation.
- Generation treats user-edited tier-1 feedback as authoritative information
  (meaning preserved, tone matched, no invented claims); every bullet records
  the feedback item that produced it, shown side-by-side at final check.
- Tier-2 edits run one polish+verify pass (information parity, same evidence
  corpus the generator uses) and land via a diff confirm; provenance never
  bypasses the gate. Confirmed bullets are stable — never re-polished, and
  regeneration preserves them (or prompts per bullet, never silent loss).
- Truth semantics identical across PDF/DOCX/Markdown exports: only renderable
  bullets leave the system.
- The match decision label stays computed on the base resume; the coverage
  panel (deterministic, no LLM) shows tailoring progress, with unclaimable
  keywords separated so the score cannot pressure fabrication.
- The fixed six-tab shell (decision 0015) is unchanged; a shared
  tailoring-stepper header spans the suggestions and draft-cv pages.

## Validation Shape

Unit tests for all pure logic (render/export gating, word-level diff,
polish-choice state machine, coverage scoring, preservation merge, edit-state
machines); API tests for the generation contract (authoritative-information
block, traceability fields), the tier-2 polish+verify endpoint (including the
no-polish deterministic fallback), and the cover-letter input change;
Playwright E2E per phase (stepper navigation, feedback→generate roundtrip with
side-by-side display, tier-2 edit→diff confirm→export, regenerate-preserves,
coverage delta). Manual LLM-spend paths follow the seeded-data pattern from
Period 11.
