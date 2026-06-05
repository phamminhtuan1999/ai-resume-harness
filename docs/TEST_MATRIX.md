# Test Matrix

This file maps product behavior to proof.

No product behavior has been defined or implemented yet. Do not mark a row
implemented until tests or validation evidence exist.

## Status Values

| Status | Meaning |
| --- | --- |
| planned | Accepted as intended behavior, not implemented |
| in_progress | Actively being built |
| implemented | Implemented and proof exists |
| changed | Contract changed after earlier implementation |
| retired | No longer part of the product contract |

## Matrix

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-001 | User sign up/login and protected workspace access | no | no | no | no | planned | `docs/stories/period-1/US-001-authentication.md` |
| US-002 | Dashboard shell with quick actions and resume empty/full states | no | no | no | no | planned | `docs/stories/period-1/US-002-dashboard-shell.md` |
| US-003 | Career profile create/update for AI-role targeting | no | no | no | no | planned | `docs/stories/period-1/US-003-career-profile.md` |
| US-004 | Resume text/file import, Docling normalization, list/detail/update | no | no | no | no | planned | `docs/stories/period-1/US-004-resume-text.md` |
| US-005 | Manual job description create/list/detail/update | no | no | no | no | planned | `docs/stories/period-1/US-005-manual-job-description.md` |
| US-006 | Optional recruiter/contact info saved with jobs | no | no | no | no | planned | `docs/stories/period-1/US-006-save-contact-information.md` |

## Evidence Rules

- Unit proof covers pure domain and application rules.
- Integration proof covers backend enforcement, data integrity, provider
  behavior, jobs, or service contracts.
- E2E proof covers user-visible browser flows.
- Platform proof covers only shell, deployment, mobile, desktop, or runtime
  behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column if the story packet
  explains why.
