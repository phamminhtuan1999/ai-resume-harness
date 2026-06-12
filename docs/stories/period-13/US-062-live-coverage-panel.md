# US-062 Live Keyword-Coverage Panel with Delta

## Status

implemented (verified 2026-06-11)

## Lane

normal

## Product Contract

While reviewing the Tailored CV, the user sees a deterministic
**keyword-coverage panel**: which of the job's extracted keywords the
renderable CV content covers, which are missing, and the delta vs the base
resume ("base 61% → tailored 84%"). The panel updates as bullets are
accepted/edited/rejected. It is explicitly NOT the match score: the decision
label remains computed on the base resume, and the panel labels itself as
tailoring coverage.

## Relevant Product Docs

- `docs/decisions/0019-single-tailored-cv.md`
- US-047 decision package (the job_keywords source of truth)

## Acceptance Criteria

- Coverage is computed deterministically (no LLM) from the job's extracted
  keywords vs (a) base resume text and (b) the renderable tailored CV content;
  both percentages and the missing-keyword list render in a side panel on the
  CV review.
- Accept/reject/edit of a bullet updates the tailored coverage without a page
  reload.
- Keywords the truth guard excluded (claims the candidate cannot support) are
  listed separately as "not claimable" — never counted as misses to chase, so
  the panel cannot pressure the user into fabricating.
- Matching is normalized (case, simple stemming/aliases reused from the
  existing keyword logic if present) and tested against fixture CVs.
- The match decision label and scores elsewhere on the page are unchanged and
  visually distinct from the coverage panel.

## Design Notes

- Pure `.mjs` coverage scorer (`coverage-view.mjs`): inputs = keywords[],
  base resume text, renderable bullet texts; outputs = {base, tailored,
  missing[], notClaimable[]}. Client-side recompute on review actions (the
  data is already on the page); server renders initial values.
- `keywords_excluded` already exists on the draft (seen in the draft-cv page
  reads) — reuse it for the not-claimable list.
- No new tables, no API change.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Scorer fixtures: empty keywords, full coverage, normalization, excluded-keyword separation, delta math. |
| Integration | n/a (pure view logic). |
| E2E | Seeded draft: panel shows base vs tailored; accepting a bullet containing a missing keyword moves the tailored number. |
| Platform | n/a |

## Harness Delta

Intake #47, decision 0019. None beyond story registration (no schema/API).

## Evidence

Implemented 2026-06-11.

- **Scorer:** pure `coverage-view.mjs` — `extractJobKeywords` (mirror of the
  API's US-047 extraction), `coverageReport` (whole-word/phrase matching,
  case-insensitive, multi-word across whitespace, "Go" never matches
  "Google"), `renderableCvTexts` (summary + skill items + renderable bullets —
  exactly the exportable content). `keywords_excluded` become **notClaimable**
  and leave the denominator, so the panel cannot pressure fabrication.
- **UI:** server-rendered `DraftCvCoveragePanel` on the draft-cv page ("Base
  resume X% → Tailored CV Y%" + delta badge + covered/missing/not-claimable
  chips), labeled as tailoring coverage, not the match score. Review/edit
  actions revalidate the page, so the number moves without a browser reload
  (no client recompute needed — the same deterministic scorer reruns on the
  refreshed server render).
- **Data:** `getDraftCvDetail` now selects `resumes.raw_text` +
  `jobs.structured_json`; no new tables, no API change.
- **Proof:** 7 unit tests (delta math, exclusion separation, object-shaped
  excluded keywords, word-boundary + C++ + multi-word matching, empty
  keywords, renderable-text collection); tsc + eslint clean. Playwright:
  seeded job keywords → "Base resume 75% / Tailored CV 50%", "RAG pipelines"
  missing, "Kubernetes" listed not-claimable; approving the pending AWS bullet
  moves the tailored number to 75% without a reload.
