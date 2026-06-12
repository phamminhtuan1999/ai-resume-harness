# US-060 Tier-2 Final Check — Polish-and-Confirm Edits, Re-verification, Regenerate Preservation

## Status

implemented (verified 2026-06-11; amended same day twice: became the
post-generation "Final check" step per decision 0019 Amendment I;
verbatim-final replaced by polish-and-confirm per Amendment II)

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

Implemented 2026-06-11.

- **API:** `bullet_edit.py` — one combined polish+verify pass
  (`polish_and_verify`) as a lightweight structured Gemini call (no run row,
  like the extractors) over the same evidence corpus the generator uses
  (`build_edit_corpus`); two deterministic floors (invented metric in the
  user's text ⇒ `do_not_use_yet`; a polish that introduces a foreign number is
  discarded for the user's wording); no-key/provider-failure fallback skips
  polish and is conservative. Endpoints: `PATCH
  /draft-cvs/{id}/bullets/{bid}/text` **stages** the server-stored result
  (`pending_edit` — previous text stays renderable),
  `POST .../text/confirm {polished|mine|cancel}` applies it (the client never
  sends a status, so the gate cannot be bypassed); chosen text lands with
  `user_edited`, `polished`, `original_text`, `finalized_at`, fresh status;
  `needs_confirmation` flows into the existing review queue.
- **Preservation:** `draft_cv_preservation.py` (pure) — generation persist
  merges finalized bullets into the new version by entry identity (same-text
  fresh bullet replaced, else appended); restructured entries become
  `preservation_conflicts`, resolved per bullet via
  `POST /draft-cvs/{id}/preservation/resolve` (keep recreates the entry shell;
  discard accepts the new content) — never a silent loss.
- **Web:** in-place `DraftCvBulletEditor` on every CV-preview bullet
  (provenance chip AI suggested / From your feedback / Edited here; "Restore
  original" prefill from `original_text`); Save shows "Checking…", then the
  word-diff confirm (reuses the US-061 LCS helper) with **Use polished**
  (default) / **Keep my wording** / Cancel and the truth-guard outcome +
  evidence question; a staged-but-unconfirmed edit reopens the confirm on
  reload. `DraftCvPreservationCard` renders the keep/take prompts.
- **Proof:** API pytest 429 passed (`test_draft_cv_edit.py`: deterministic
  floors, Gemini parity/status floors, stage→confirm state machine incl.
  cancel/no-stage-404, wired endpoints with status recompute; workflow tests:
  regenerate carries finalized bullets / restructured entry surfaces a
  conflict). Web 235 unit tests (bullet edit-state projection, conflict
  labels), tsc + eslint clean. Playwright: live edit→"Keep my wording" lands
  the exact text (one real single-bullet pass), conflict keep/take roundtrip
  with DB-seeded conflict.
- **Note on the packet's single-PATCH shape:** implemented as stage + confirm
  (two server calls, one LLM pass) so the applied text/status always come from
  server-stored data; "not renderable while checking" is the in-flight UI
  state — the previous text stays renderable until confirm, which also covers
  the failure-keeps-previous-text AC.
