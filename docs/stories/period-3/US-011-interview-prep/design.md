# Design

## Domain Model

Interview prep is generated from a match. It contains four output groups:

- Question sets by interview category.
- Weak topics to study or build proof for.
- A compact study plan.
- Answer guidance grounded in resume evidence.

Unsupported missing skills are explicitly labeled as preparation gaps.

## Application Flow

Command:

- `generateInterviewPrepAction` validates the signed-in user, validates
  `match_id`, loads a user-owned match with resume and job context, generates
  deterministic prep, persists an `interview_preps` row, and revalidates match
  pages.

Query:

- `getInterviewPrepDetail(matchId)` loads the user-owned match and latest prep
  rows for the page.

## Interface Contract

Route:

- `/matches/:matchId/interview-prep`

Messages:

- Success: `Interview prep generated.`
- Failure: missing match, missing context, or missing Period 3 schema.

## Data Model

Migration adds `public.interview_preps`:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid references public.user_profiles(id) on delete cascade`
- `match_id uuid references public.matches(id) on delete cascade`
- `questions_json jsonb not null`
- `weak_topics_json jsonb not null`
- `study_plan_json jsonb not null`
- `answer_guidance_json jsonb not null`
- timestamps

Indexes:

- `(user_id, created_at desc)`
- `(match_id, created_at desc)`

RLS is enabled; server actions write through the service client after explicit
ownership checks.

## UI / Platform Impact

The match report gets an `Interview prep` CTA. The new page uses the existing
AppShell, card layout, success popup, and server-action form pattern.

## Observability

Action failures use the existing `ApplyWise action skipped` warning path.

## Alternatives Considered

1. Generate prep without persistence. Rejected because MVP output history should
   survive navigation and reloads like roadmaps and drafts.
2. Reuse `roadmaps`. Rejected because interview prep has different JSON shape
   and product contract.
