# US-061 Tier-1 Feedback Step — Suggestions Stepper, Tone-True Weave, Traceability

## Status

planned (amended 2026-06-11 twice: elevated to the official pre-generation
feedback step per decision 0019 Amendment I; verbatim weave replaced by
information-preserving tone-true weave per Amendment II)

## Lane

normal

## Product Contract

Tailoring is a visible stepper: **Suggest → Respond → Generate → Final check →
Export**. The suggestions page is the official "Respond" step: every suggestion
is accepted, **manually edited**, or rejected, with provenance recorded
(`ai_suggested` vs `user_edited`). The link to generation is explicit. The
generator treats user-edited feedback as **authoritative information**: it
preserves the meaning, rewords to match the CV's tone, and never invents
claims beyond the feedback + evidence. Every produced bullet records which
feedback item produced it, and the final check shows the user's feedback text
beside the produced bullet so information drift is visible and rejectable.

## Relevant Product Docs

- `docs/decisions/0019-single-tailored-cv.md` (Amendments I and II)
- US-031 resume suggestions story (period-9) — the workflow survives; its
  surface is elevated, not retired.

## Acceptance Criteria

- A shared tailoring-stepper header renders on the suggestions and draft-cv
  pages showing the five steps and the current position; steps link across the
  Resume Strategy / Application Materials tabs (decision 0015 shell unchanged).
- Each suggestion on the Respond step shows a word-level diff vs the base
  resume text, the reason, and the evidence; actions are accept / edit /
  reject. An accepted-with-edit suggestion stores `user_edited: true` and the
  exact feedback text.
- The Generate step displays "N approved responses shape this CV" and warns
  when 0 are approved.
- Generation contract: a bullet produced from user-edited feedback preserves
  the feedback's information (prompt marks it "authoritative information —
  preserve meaning, match the CV's tone, no new claims"); wording may differ.
- Each generated bullet carries `source_feedback_id` (nullable) in cv_json;
  the final-check view shows provenance chips ("from your feedback" /
  "AI suggested") and, for user-fed bullets, the original feedback text
  side by side so the user can verify their information survived.
- Truth Guard still evaluates every produced bullet; user-fed information
  without evidence lands as needs_confirmation (owner answer 3) — provenance
  never bypasses the gate.
- Regenerating suggestions resets only un-responded items; existing responses
  survive a suggestions refresh.

## Design Notes

- Word-level diff helper: pure `.mjs` (LCS), unit-tested; used on the Respond
  step (base vs suggested text) and reused by US-060's polish confirm.
- Suggestions persistence already supports accepted/rejected + edited text
  (`patchResumeSuggestion`); add the provenance flag if absent.
- DraftCvWorkflow prompt: an "authoritative information" block lists
  user-edited feedback; no deterministic verbatim post-check (Amendment II) —
  information survival is verified by the user at final check via the
  side-by-side display.
- cv_json bullets gain `source_feedback_id` (additive JSON, no migration).
- Stepper header: one shared component reading match id + artifact presence
  (suggestions exist? draft exists?) to compute the current step.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Diff helper (insert/delete/replace, unicode, empty); stepper state machine (which step is current). |
| Integration | API: generation persists source_feedback_id; prompt includes the authoritative-information block; user-edited unsupported claim lands needs_confirmation. |
| E2E | Respond to seeded suggestions (one accept, one edit, one reject) → Generate → produced bullet linked to the edited feedback with the side-by-side display; provenance chips render; stepper navigates across tabs. |
| Platform | n/a |

## Harness Delta

Intake #47, decision 0019 (Amendments I–II). Durable story row predates the
amendments (CLI has no contract update); this packet is the source of truth.

## Evidence

Added after verification.
