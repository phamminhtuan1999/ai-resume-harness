# US-010 Generate 4-Week Improvement Roadmap

## Status

implemented

## Lane

high-risk

## Product Contract

Authenticated users can generate a 4-week improvement roadmap for a match based
on missing skills, target role, and canonical resume context. Critical gaps must
be prioritized first, and each week must include goal, skills covered, tasks,
deliverables, suggested project work, and a resume bullet to add after real
completion.

## Relevant Product Docs

- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`

## Acceptance Criteria

- Given a match exists, when I open `/matches/:id/roadmap`, then I can generate
  a 4-week roadmap.
- Given missing skills exist, then critical gaps are prioritized first.
- Given a roadmap is generated, then exactly four weeks are persisted in
  `roadmaps.roadmap_json`.
- Given a week is shown, then it includes goal, skills covered, tasks,
  deliverables, suggested project work, and resume bullet after completion.

## Design Notes

- Commands: generate roadmap for match.
- Queries: get match by id, list roadmaps by match id.
- API: server action for MVP web flow; backend AI orchestration can replace the
  deterministic generator later.
- Tables: `matches`, `resumes`, `jobs`, `roadmaps`.
- Domain rules: roadmap bullets are after-completion suggestions, not claims to
  use immediately.
- UI surfaces: `/matches/:id`, `/matches/:id/roadmap`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Roadmap generator returns exactly four weeks and prioritizes critical gaps. |
| Integration | Server action persists a `roadmaps` row with current-user ownership. |
| E2E | User generates a roadmap and sees the persisted four-week plan. |
| Platform | Next production build includes `/matches/[matchId]/roadmap`. |
| Release | Period 3 smoke includes roadmap generation. |

## Harness Delta

Added US-010 to Harness and marked implemented with unit, integration, e2e, and
platform proof flags.

## Evidence

- `apps/web/src/lib/roadmap-generator.mjs` builds exactly four weekly plans and
  prioritizes critical missing skills first.
- `apps/web/src/lib/actions.ts` persists generated roadmaps through
  `generateRoadmapAction`.
- `apps/web/src/app/matches/[matchId]/roadmap/page.tsx` renders the generator,
  success alert, latest roadmap, and all four week cards.
- `apps/web/supabase/migrations/0005_period3_roadmaps.sql` creates
  `public.roadmaps`; migration was applied with `SUPABASE_DB_URL`.
- Supabase verification confirmed latest row
  `5f1490c2-51a4-4d7c-a715-dfd57cdcb6e6` has
  `jsonb_array_length(roadmap_json->'weeks') = 4`.
- Signed-in in-app browser generated a roadmap for match
  `98ed9270-a036-4cb3-a644-613854790963` and rendered success plus Week 1
  through Week 4.
- `npm run test:web`, `npm run lint:web`, and `npm run build:web` passed.
