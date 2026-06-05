# US-001 User Sign Up And Login

## Status

planned

## Lane

high-risk

## Product Contract

Users can sign up, log in, access their private workspace, and log out through
Clerk. Protected pages and protected API calls must reject unauthenticated
access.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/architecture.md`

## Acceptance Criteria

- Given I am a new user, when I open ApplyWise, then I can sign up using Clerk.
- Given I am an existing user, when I log in, then I am redirected to my
  dashboard.
- Given I am not logged in, when I try to access protected pages, then I am
  redirected to the login page.
- Given I am logged in, when I click logout, then my session is ended.
- Given I call a protected API route without valid Clerk identity, then the API
  returns unauthorized without exposing private data.

## Design Notes

- Commands: sign-in, sign-up, logout, protected-route redirect.
- Queries: current Clerk user, app-level profile lookup when needed.
- API: protected API calls must verify Clerk token or session identity.
- Tables: `user_profiles` is created or linked after authenticated account
  setup.
- Domain rules: user-owned data is private to the authenticated Clerk user.
- UI surfaces: `/sign-in`, `/sign-up`, `/dashboard`, protected app shell.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Route matcher and auth helper behavior where implemented. |
| Integration | Protected API route rejects unauthenticated requests and accepts authenticated requests. |
| E2E | Sign up/sign in redirect flow and protected page redirect flow. |
| Platform | Vercel/Clerk environment variables present and deployment auth smoke when deployed. |
| Release | Full Period 1 smoke includes authenticated dashboard access. |

## Harness Delta

This story is high-risk because auth is a hard gate in `docs/FEATURE_INTAKE.md`.
Implementation should use the high-risk story template or split into smaller
confirmed auth setup stories before code changes.

## Evidence

No implementation proof yet.

