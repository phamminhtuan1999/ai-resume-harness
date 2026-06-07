# Validation

## Proof Strategy

Use static tests to lock public/pricing/settings contracts, browser checks for
rendered public and protected surfaces, and production build proof.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `/` has landing copy and no dashboard redirect; pricing has no checkout/Stripe; settings uses live data and no fake destructive buttons. |
| Integration | Protected settings reads workspace/profile/tracker data through existing server data functions. |
| E2E | Browser verifies `/`, `/pricing`, `/settings`, and `/dashboard` render expected Period 4 content. |
| Platform | Next production build. |
| Performance | Server components keep data loading server-side. |
| Logs/Audit | No new audit behavior. |

## Fixtures

- Existing signed-in local Clerk session.
- Existing seeded workspace records from prior story proofs.

## Commands

```text
npm run test:web
npm run lint:web
npm run build:web
git diff --check
```

## Acceptance Evidence

- `npm run test:web` passed 43 tests, including Period 4 static surface
  checks for `/`, `/pricing`, and `/settings`.
- `npm run lint:web` passed.
- `git diff --check` passed.
- Browser desktop checks verified:
  - `/` renders the public landing page with `ApplyWise`, `Start workspace`,
    `View pricing`, and `Apply now or improve first?`.
  - `/pricing` renders `Payment disabled in MVP`, disabled `Coming soon`
    controls, and `No checkout in MVP`.
  - `/settings` renders live account/workspace data, `Workspace records`,
    `Deletion is intentionally unavailable`, and `Demo readiness`.
  - `/dashboard` renders `AI workflow status` with implemented MVP workflow
    modules.
- Fresh browser tab check showed no framework overlay; `/` and `/pricing` had
  no console warnings, and `/settings` only showed Clerk's expected local
  development-key warning.
- Mobile viewport `390x844` verified `/` and `/pricing` render expected
  landing/pricing content with no framework overlay.
- `npm run build:web` passed after approved Turbopack escalation. The sandbox
  build attempt failed with the known Turbopack port-bind restriction.
