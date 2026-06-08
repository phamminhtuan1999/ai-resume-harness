# Validation

## Proof Strategy

Proof must show that visual changes did not break existing workflows and that
desktop/mobile rendering remains stable.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Static tests for public pricing/landing constraints and shared UI system presence. |
| Integration | Not required because data loading and server actions are unchanged. |
| E2E | Browser walkthrough of landing, pricing, dashboard, resumes, jobs, matches, tracker, profile, and settings. |
| Platform | Desktop and mobile screenshots with console inspection. |
| Performance | Production build must pass. |
| Logs/Audit | Browser console must have no new app errors during checked flows. |

## Fixtures

Use the existing local signed-in session and seeded workspace data where
available. No new database fixtures are required.

## Commands

```text
npm run test:web
npm run lint:web
npm run build:web
git diff --check
```

## Acceptance Evidence

- `npm run test:web` passed 46 tests, including `apps/web/tests/ui-system.test.mjs`.
- `npm run lint:web` passed.
- `npm --workspace apps/web exec tsc -- --noEmit` passed.
- `git diff --check` passed.
- `npm run build:web` passed after approved escalation.
- Browser route check on `http://localhost:3000` verified `/`, `/pricing`,
  `/dashboard`, `/resumes`, `/jobs`, `/matches`, `/matches/new`, `/tracker`,
  `/profile`, and `/settings` all render meaningful content, have an `h1`, show
  no framework overlay, and have no horizontal overflow.
- Browser interaction proof clicked the header `Analyze match` link from
  `/dashboard` and landed on `/matches/new` with `h1` equal to
  `Generate match analysis`.
- Browser console warnings were limited to the known Clerk development-key
  warning.
- Screenshot evidence captured:
  - `/var/folders/14/4v97h5h10dd8yg297nx2ntv80000gp/T/applywise-us014-dashboard-desktop.png`
  - `/var/folders/14/4v97h5h10dd8yg297nx2ntv80000gp/T/applywise-us014-resumes-mobile.png`
