# US-003 Create User Career Profile

## Status

in_progress

## Lane

normal

## Product Contract

Authenticated users can create and update a career profile so future analysis is
tailored to AI-focused engineering roles.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`

## Acceptance Criteria

- Given I am on profile setup, when I enter current role, years of experience,
  and target role, then the system saves my profile.
- Given I choose a target role, when options are displayed, then I can select
  AI Engineer, Applied AI Engineer, LLM Engineer, GenAI Engineer, or ML
  Engineer.
- Given my profile is saved, when I return to the dashboard, then I can see my
  target role.

## Design Notes

- Commands: create or update profile.
- Queries: get profile by authenticated Clerk user.
- API: `GET /api/profile`, `PUT /api/profile`.
- Tables: `user_profiles`.
- Domain rules: `clerk_user_id` is unique; target role must come from the
  accepted option set.
- UI surfaces: `/profile`, dashboard profile summary.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Profile validation schema accepts required target-role options and rejects invalid input. |
| Integration | Profile create/update persists under the authenticated user and does not modify another user. |
| E2E | User saves profile and sees target role on dashboard. |
| Platform | Not required for local MVP proof. |
| Release | Period 1 smoke includes profile setup. |

## Harness Delta

No harness change expected.

## Evidence

Scaffold evidence:

- `apps/web/src/app/profile/page.tsx`

Persistence, validation, and authenticated ownership proof are not implemented
yet.
