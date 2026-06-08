# Validation

## Proof Strategy

Proof must show that profile extraction is schema-valid, evidence-bound to the
resume text, reviewable before save, and persisted only after user confirmation.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Candidate profile schema parsing, confidence parsing, low-confidence field mapping, no-invention guard fixtures. |
| Integration | Protected extraction endpoint reads only owned resumes, rejects missing resume text, validates AI JSON, saves reviewed profile. |
| E2E | Browser imports profile from an existing resume, reviews auto-filled fields, edits one field, saves, and sees active profile updated. |
| Platform | API timeout behavior, sensitive text not logged, build proof. |

## Fixtures

Use resume text fixtures for:

- complete software engineer resume
- resume with missing contact info
- resume with projects and work experience mixed together
- weak/uncertain dates
- hallucination-prone prompt case

## Commands

```text
apps/api/.venv/bin/python -m pytest apps/api/tests
npm run test:web
npm run lint:web
npm --workspace apps/web exec tsc -- --noEmit
npm run build:web
git diff --check
```

## Acceptance Evidence

Add command output, browser proof, database proof, and no-invention fixture
proof during implementation.
