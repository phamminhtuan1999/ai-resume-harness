# US-062 Live Keyword-Coverage Panel with Delta

## Status

planned

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

Added after verification.
