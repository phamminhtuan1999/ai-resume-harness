# US-060 Tier-2 Final Check — Polish-and-Confirm Edits, Re-verification, Regenerate Preservation

## Status

planned (amended 2026-06-11 twice: became the post-generation "Final check"
step per decision 0019 Amendment I; verbatim-final replaced by
polish-and-confirm per Amendment II)

## Lane

normal

## Product Contract

The Final check step lets the user edit any bullet **in place on the CV**. An
edit is **information-level feedback**: one server pass **tone-polishes** the
user's text (reword to the CV's voice, information parity — no claims added or
dropped) and runs **truth-guard verification**. The user confirms via a
word-diff between their text and the polished text — default is the polished
version; "keep my wording" stays available for exact terminology. The chosen
text carries its truth-guard status (safe / needs_confirmation with the
evidence question / do_not_use_yet) and only renderable text exports. A
confirmed bullet is **final and stable**: never re-polished, and
**regeneration preserves it** — where preservation is impossible the user gets
a per-bullet keep/take diff prompt, never a silent overwrite.

## Relevant Product Docs

- `docs/decisions/0019-single-tailored-cv.md` (Amendments I and II)
- US-039/US-040 draft CV + truth guard stories (period-10)

## Acceptance Criteria

- Each bullet in the Final check view has an Edit affordance; saving submits
  the text and returns `{polished_text, truth_guard_status,
  evidence_question?}` from one combined polish+verify server call.
- The UI shows a word-level diff (user's text vs polished text) with actions:
  **Use polished** (default) / **Keep my wording** / cancel. The chosen text
  persists with `user_edited: true`, a `polished` flag, and the fresh status.
- Polish holds information parity: it may not add claims or drop facts
  relative to the user's edit (prompt constraint; the deterministic fallback
  skips polish entirely and verifies the user's text unchanged —
  conservative: needs_confirmation when uncertain, never safe by default).
- While the pass is pending the bullet shows "checking…" and is NOT
  renderable; a failure keeps the previous text renderable and surfaces the
  error.
- needs_confirmation flows into the existing approve/reject review with its
  evidence question; do_not_use_yet is excluded from preview and export with
  the existing messaging.
- A confirmed bullet is stable: no later workflow step re-polishes or rewords
  it; exports emit it exactly as confirmed when renderable.
- **Regenerate preservation:** confirmed bullets are carried into the new
  version unchanged (keyed by stable bullet id + entry identity); if
  regeneration restructures their entry, a per-bullet diff prompt (keep mine /
  take new) decides — never a silent loss.
- Bullet history records `original_text` (single-level revert); provenance
  chips distinguish AI-generated / from-your-feedback (US-061) / edited-here.
- Works for work-experience and project bullets.

## Design Notes

- API: `PATCH /api/draft-cvs/{id}/bullets/{bulletId}/text` runs one workflow
  pass (polish + verify; Gemini + deterministic fallback per decision 0012)
  and persists
  `{text, user_edited, polished, original_text, truth_guard_status,
  user_action, finalized_at}` following the `patchDraftCvBullet` convention.
- The polish prompt is single-bullet scoped with the CV's existing bullets as
  tone context (cheap, low tokens).
- Preservation merge: pure, testable module; previous version's finalized
  bullets keyed by stable id + entry identity.
- UI: inline editor on the draft-cv page; diff-confirm reuses the US-061 LCS
  helper; optimistic "checking" via useActionState; no new dependency.
- Tables: cv_json bullet objects gain the fields above (additive JSON, no
  migration).
- Tier-2 polish covers automatic tone-matching only; user-directed tone/length
  controls remain deferred (US-064 candidate, decision 0019 Follow-Up).

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Edit-state machine (pending→statuses; failure keeps prior text); polish-choice handling (use-polished vs keep-mine); preservation merge (kept, restructured→prompt, new entry); revert; render gating. |
| Integration | API: ownership 404; combined pass persists chosen text + status; fallback = no polish + conservative verify; no-export-of-pending; regenerate carries finalized bullets. |
| E2E | Edit a seeded bullet → diff confirm → chosen text + status chip render → export contains the confirmed text; regenerate → finalized bullet survives. |
| Platform | n/a |

## Harness Delta

Intake #47, decision 0019 (Amendments I–II). New API endpoint registered in
the workflow/API docs; truth-guard semantics doc gains "edits are polished for
tone with information parity, then re-verified; confirmed text is stable".
Durable story row predates the amendments; this packet is the source of truth.

## Evidence

Added after verification.
