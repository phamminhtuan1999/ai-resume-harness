# Validation

## Proof Strategy

Proof must show that field validation is deterministic, the shared form UI
renders across representative routes, and production build behavior is intact.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Field-error mapping, required values, URL, email, UUID, file type, and file size rules. |
| Integration | Resume import flow rejects invalid local files before API fetch and preserves API detail failures. |
| E2E | Browser render checks for job, resume, profile, and match forms. |
| Platform | Desktop and mobile form screenshots plus console inspection. |
| Performance | Production build must pass. |
| Logs/Audit | Browser console must have no new app errors during checked flows. |

## Fixtures

Use the existing local signed-in session and seeded workspace data where
available. No new database fixtures are required.

## Commands

```text
npm run test:web
npm run lint:web
npm --workspace apps/web exec tsc -- --noEmit
npm run build:web
git diff --check
```

## Acceptance Evidence

- `npm run test:web` passed 48 tests, including validation helper and resume
  import flow coverage.
- `npm run lint:web` passed.
- `npm --workspace apps/web exec tsc -- --noEmit` passed.
- `npm run build:web` passed after approved escalation for Turbopack's local
  worker port.
- Browser route checks on `http://localhost:3000/jobs/new`,
  `/resumes/new`, `/profile`, and `/matches/new` found meaningful content, no
  framework overlay, no horizontal overflow, and no browser console errors.
- Mobile browser check on `/resumes/new` confirmed no horizontal overflow and
  the resume file input accepts PDF, DOCX, images, Markdown, and text.
- Screenshot evidence captured:
  - `/private/tmp/applywise-us015-job-desktop.png`
  - `/private/tmp/applywise-us015-resume-mobile.png`
