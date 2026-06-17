# 0019 One Tailored CV — Kill the Markdown Resume Draft, Two-Tier Feedback Flow

Date: 2026-06-11 (amended twice same day after owner critique — see Amendments)

## Status

Accepted

## Context

The app ships two sibling "tailored resume" generators that share inputs but
not curation: the Markdown resume draft (`ResumeDraftWorkflow`, US-032,
`resume_versions`) and the structured Draft CV (`DraftCvWorkflow`, US-039,
`draft_cvs`, Truth Guard + PDF/DOCX export). Both read resume text + accepted
resume suggestions; neither reads the other's output. The owner hit the
resulting dead end: bullets curated on the Draft CV page never influence the
generated resume draft. The owner also reports the app is hard to use: three
review surfaces with three different verbs, and the suggestions→generation
link is invisible in the UI.

Market research (2026): the category converged on one base resume → one
tailored document per job; inline accept/reject with word-level diff previews;
a live match/keyword score; export as a format choice from the single
artifact. Simultaneously, AI-fabrication is a top recruiter concern (72%
encounter AI-faked applications), making the app's Truth Guard a
differentiator to amplify.

Owner answers that shaped this decision (asked explicitly, 2026-06-11):

1. The Markdown resume draft output is **never used** — feature kill, not a
   merge.
2. Application style is **few, high-effort** (5–10/week) — a review gate on
   the main path fits.
3. Hand-edited content must be **re-checked against evidence** — the
   "everything exported is verified" guarantee stays absolute.
4. Investment: **full redesign as Period 13**, phased, step by step.
5. (Amendment I) The owner's target flow: **give feedback on AI suggestions
   first (accept / manually edit / reject), then generate the final CV from
   that feedback** — curation upstream, generation downstream.
6. (Amendment II) Hand edits are **information-level feedback**, not final
   wording: the LLM should reword the user's edits to match the CV's tone.
   The owner explicitly does NOT want verbatim preservation of their text.

## Decision

Guiding principle: **the user owns the information; the LLM owns the tone;
Truth Guard owns the truth.**

- **Retire the Markdown resume draft feature** (page, action, `tailored-resume`
  segment, `ResumeDraftWorkflow`). Not in the orchestrator manifest — no
  orchestrator change. `resume_versions` stays in the schema but gains no new
  rows; dropping it is deferred.
- **`draft_cvs` is the single Tailored CV artifact.** Markdown becomes a third
  export format alongside PDF/DOCX, rendered from the same gated render model.
- **Two-tier feedback flow** presented as a visible stepper
  (Suggest → Respond → Generate → Final check → Export):
  - **Tier 1 — strategy feedback, before generation.** The suggestions review
    is the official "Respond" step: each suggestion is accepted, manually
    edited, or rejected; provenance (`ai_suggested` vs `user_edited`) is
    recorded; the UI states explicitly that approved feedback shapes the next
    generation.
  - **Generation contract.** User-edited feedback is **authoritative
    information**: the generator must preserve its meaning and may reword it
    to match the CV's tone, never inventing claims beyond the feedback +
    evidence. Every produced bullet records which feedback item produced it
    (`source_feedback_id`); the final check shows the user's feedback text
    next to the produced bullet so information drift is visible and
    rejectable.
  - **Tier 2 — text feedback, after generation (final check).** Bullets are
    editable in place. An edit triggers one server pass: **tone-polish**
    (reword to CV tone, information parity — no claims added or dropped) +
    **truth-guard verification**. The user confirms via a word-diff (default:
    use the polished text; "keep my wording" remains available). Confirmed
    bullets are **final and stable**: never re-polished, and **regeneration
    preserves them** (or warns with a per-bullet keep/take prompt — no
    regenerate lottery, no silent loss).
- **Strict Truth Guard everywhere:** generated text, tier-1 edits, and tier-2
  edits all carry a `truth_guard_status`; provenance never bypasses the gate;
  only renderable bullets export, identically in all three formats.
- **Live coverage panel:** deterministic keyword coverage (base vs tailored;
  unclaimable keywords listed separately, never as misses to chase). The match
  decision label remains computed on the base resume.
- **Cover letter consumes the final Tailored CV**, not the raw resume.
- Tabs keep the fixed six-tab shell (decision 0015); a shared
  tailoring-stepper header spans the suggestions and draft-cv pages.

## Amendment I (2026-06-11, owner critique — flow shape)

The original decision reviewed all changes on the generated document
(suggestions queue retired, review only after generation). The owner pushed
back: their target flow is feedback-before-generation. Accepted: the
pre-generation feedback tier becomes the backbone; the post-generation final
check is kept because generation is non-deterministic and full regeneration to
fix one bullet shuffles approved content.

## Amendment II (2026-06-11, owner critique — edit semantics)

Amendment I specified user text as **verbatim-final** (woven and exported
byte-identically). The owner overruled: edits are information-level feedback
and the LLM should own the wording so the CV reads in one voice. Superseded:
the verbatim weave hard-constraint and deterministic verbatim post-check.
Replacing safeguard for meaning drift: tier-2 polish must hold information
parity and the user confirms a diff before the polished text lands; tier-1
information survival is checked by the user at final check via the
side-by-side feedback display. "Keep my wording" remains as an escape hatch
for exact terminology.

## Alternatives Considered

1. **Merge the two generators** — rejected: the Markdown draft has no users; a
   kill is cheaper and more honest.
2. **One-way feed (resume draft reads approved Draft CV)** — rejected: keeps
   two artifacts alive for zero added user value.
3. **Pure curate-then-generate (no tier 2)** — rejected: any post-generation
   fix would force a full regenerate that shuffles approved content, and the
   user would be reviewing abstractions, never the deliverable.
4. **Pure generate-then-curate (original shape)** — superseded by Amendment I:
   it hid the strategy tier the owner wants to drive.
5. **Verbatim-final user text (Amendment I shape)** — superseded by Amendment
   II: it would make user-edited bullets stick out tonally from the rest of
   the CV; drift risk is handled by confirm-diffs, not by freezing text.
6. **Free-text edits without re-verification** — rejected by the owner: it
   converts the export guarantee from absolute to statistical.
7. **Re-running full match analysis against the tailored CV** — rejected: the
   decision label should reflect real standing; coverage delta gives the
   iteration signal cheaply.

## Consequences

Positive:

- One artifact, one visible flow, two clearly-purposed feedback tiers; the
  curation dead-end disappears structurally.
- The CV reads in one voice while the user's information always wins; Truth
  Guard is the visible centerpiece.
- Tier-2 polish+verify absorbs the "AI-assisted rewrite" market gap
  (automatic tone-matching; user-selected tone/length controls remain
  deferred as US-064).
- Less code: one workflow, one page-set, one export path.

Tradeoffs:

- Each tier-2 edit costs one LLM pass (polish+verify combined; acceptable at
  5–10 applications/week; deterministic fallback skips polish and only
  verifies).
- One extra confirm click per tier-2 edit (the meaning-drift safeguard).
- Regenerate-preservation adds merge complexity to the generation writer.
- `resume_versions` dormant until a later cleanup migration.
- Durable harness rows for US-060/US-061 contracts predate the amendments
  (CLI has no story-contract update; the md packets are the source of truth).

## Follow-Up

- Period 13 stories US-059..US-063, phases 1–4
  (execution order US-059 → US-061 → US-060 → US-062/063).
- Candidate US-064 (deferred): user-directed rewrite controls (tone/length
  selection) on top of the tier-2 polish, same verification gate.
- Revisit dropping `resume_versions` after Period 13 ships.
