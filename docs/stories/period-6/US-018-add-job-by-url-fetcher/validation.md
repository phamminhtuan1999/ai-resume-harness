# Validation

## Proof Strategy

Proof must cover URL validation, duplicate protection, provider success,
provider failure fallback, extraction schema validation, persistence, scoring,
and browser flow.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | URL normalization, duplicate-key behavior, extraction schema parsing, score display mapping. |
| Integration | Protected API rejects unauthenticated requests, Firecrawl fixture succeeds, provider failure returns fallback state, duplicate URL does not create a new job. |
| E2E | Browser adds a job by URL, sees success popup/list redirect, and sees job score/status in `/jobs`. |
| Platform | Firecrawl env var setup, API timeout behavior, build proof, no raw fetched content in logs. |

## Fixtures

Use static fixture payloads for:

- company career page
- Greenhouse-style page
- Lever-style page
- Workday-style page
- fetch failure
- invalid AI extraction response
- duplicate normalized URL

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

Add command output, browser proof, and provider fixture proof during
implementation.
