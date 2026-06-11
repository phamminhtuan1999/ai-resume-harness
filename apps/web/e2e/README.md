# Browser E2E (Playwright)

Repeatable end-to-end coverage for the Period 11 decision-first job-analysis
experience. Drives a real Chromium browser against the running app, signs in a
Clerk test user, seeds a populated analyzed match directly in the DB, asserts the
UI, and tears the seed down.

## Prerequisites

1. **Servers** — the web app (`:3000`) and API (`:8000`). The Playwright config
   reuses them if already running, otherwise starts them
   (`npm run dev` + uvicorn). Start manually with `npm run dev:web` and
   `npm run dev:api` from the repo root if you prefer.
2. **Env** — `apps/web/.env` (gitignored) must contain the app's Clerk +
   Supabase keys (already there for local dev) plus:
   - `E2E_CLERK_USER_PASSWORD` — the password of the Clerk test user below.
   - optional `E2E_CLERK_USER_EMAIL` — defaults to
     `period11e2e+clerk_test@example.com`.
3. **A Clerk test user** in the **development** instance (`pk_test`). The default
   is `period11e2e+clerk_test@example.com` — a Clerk `+clerk_test` address, so it
   needs no real inbox. Create it once via the sign-up page (any password), then
   put that password in `E2E_CLERK_USER_PASSWORD`.

## Run

```bash
cd apps/web
npm run test:e2e        # headless
npm run test:e2e:ui     # Playwright UI mode
```

## How it works

- `playwright.config.ts` — loads `apps/web/.env`, runs the `setup` project
  (`global.setup.ts` → `clerkSetup()` for a testing token) before `chromium`,
  reuses running dev servers.
- `e2e/support/auth.ts` — `setupClerkTestingToken` + `clerk.signIn` (password
  strategy) — no brittle form typing.
- `e2e/support/db.ts` — a service-role Supabase client seeds a complete analyzed
  match + three decision snapshots (a label transition **and** a `rules_version`
  change) using fixed UUIDs, then deletes them. `resolveProfileId` maps the
  signed-in Clerk user to their `user_profiles` row.
- `e2e/fixtures.ts` — the `seededMatchId` fixture: sign in → ensure profile →
  seed → run test → teardown.
- `e2e/period11.spec.ts` — covers US-048/049/051/052/053/054 surfaces.

## Notes

- Seeding writes to the **live** Supabase DB under the test user's profile only;
  the fixture tears everything down (including any learning target the test
  saved). It never touches other accounts.
- It does **not** exercise Refresh Analysis (that would make real Gemini calls);
  the control's presence is asserted, the async chain is covered by the
  API/integration tests.
