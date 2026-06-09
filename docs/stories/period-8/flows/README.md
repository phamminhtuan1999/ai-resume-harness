# Period 8 — Development Flow Docs

Implementation-ready flow documentation for the AI Assistant Intelligence
Overhaul (US-027–US-038). One doc per story, each with: feature summary, user
flow, technical flow, AI behavior, data-model impact, API, UI, acceptance
criteria, Mermaid diagrams (user / sequence / data / AI), and concrete dev
tasks.

**Read first:** `US-027-ai-workflow-foundation-flow.md` — it defines the shared
conventions (response envelope, `BaseAIWorkflow` flow, `ai_workflow_runs` +
`activity_feed`, error taxonomy, prompt preamble, provider/fallback rule) that
every other doc inherits and references. Direction is set by
`docs/decisions/0012-ai-workflow-standards.md`.

| Doc file | Feature | Story packet |
| --- | --- | --- |
| `US-027-ai-workflow-foundation-flow.md` | 12 | `../US-027-ai-workflow-foundation/` |
| `US-028-ai-match-analyzer-flow.md` | 1 | `../US-028-ai-match-analyzer/` |
| `US-029-ai-missing-skill-analysis-flow.md` | 2 | `../US-029-ai-missing-skill-analysis.md` |
| `US-030-job-assistant-insight-card-flow.md` | 8 | `../US-030-job-assistant-insight-card.md` |
| `US-031-ai-resume-suggestions-flow.md` | 3 | stub (backlog) |
| `US-032-ai-tailored-resume-draft-flow.md` | 4 | stub (backlog) |
| `US-033-ai-cover-letter-flow.md` | 5 | stub (backlog) |
| `US-034-ai-roadmap-flow.md` | 6 | stub (backlog) |
| `US-035-ai-interview-prep-flow.md` | 7 | stub (backlog) |
| `US-036-dashboard-ai-summary-flow.md` | 9 | stub (backlog) |
| `US-037-ai-activity-feed-flow.md` | 10 | stub (backlog) |
| `US-038-ai-workflow-panel-flow.md` | 11 | stub (backlog) |

Source brief: `applywise_ai_assistant_update_tasks.md` (repo root).

## Migration numbering (canonical)

Individual flow docs propose migration filenames, but because US-031–US-038 are
stubs that will be implemented per-epic in an order not yet fixed, **migration
numbers inside the stub docs are TENTATIVE**. Assign the next free number at
implementation time. The only firm assignments are for the authored packets:

| Migration | Story | Adds |
| --- | --- | --- |
| `0010_period8_ai_workflow_foundation.sql` | US-027 | `ai_workflow_runs`, `activity_feed` |
| `0011_period8_match_analysis_ai.sql` | US-028 | AI columns on `matches` |
| `0012_period8_missing_skills.sql` | US-029 | `missing_skill_analyses` |
| `0013_period8_assistant_insight.sql` | US-030 | `assistant_insights` |
| _next free_ | US-031–US-038 | per each doc's Data Model section (tentative) |

Rule of thumb for the stubs: US-031/US-034/US-035 mostly reuse existing tables
(suggestions/roadmaps/interview_preps) and may need only additive columns or no
migration; US-033 (`cover_letters`) and US-036 (`dashboard_ai_summary`) need new
tables; US-037 needs none (reuses `activity_feed`); US-038 needs none unless it
adds an `applications.status = 'prepared'` value or writes run rows for the
pre-match steps. The `workflow_type` enum is defined once in
`0010_period8_ai_workflow_foundation.sql` — extend it there rather than per
feature.

## Cross-cutting assumptions captured by the docs

- **Routing:** every doc is match-centric; the brief's `/jobs/:id/*` URLs map to
  `/matches/[matchId]/*`. US-038 documents the `{ jobId, resumeId? }` →
  `{ matchId }` prop adaptation.
- **Truth Guard storage:** US-031 maps the AI snake_case enum
  (`safe_to_use`/`needs_confirmation`/`do_not_use_yet`) to the title-case values
  already stored in `resume_suggestions.truth_guard_status`.
- **Snapshot reads:** several docs read upstream results from
  `ai_workflow_runs.output_snapshot_json` when a dedicated domain table is not
  guaranteed; treat that as the fallback read path.
- **Provider/fallback:** every feature uses Gemini primary + the existing
  deterministic generator as the typed fallback; `confidence_score < 0.5` →
  `needs_review`.
