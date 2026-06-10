# Story Backlog

This backlog will be populated after a user provides a project spec or selects a
specific initiative.

Do not create every possible story packet up front. Create story packets when
the work is selected or when a product decision needs a durable place to land.

## Candidate Epics

| Epic | Description | Status |
| --- | --- | --- |
| Period 1 Foundation | Auth, dashboard, profile, resume text/file import, manual job description, and contact capture. | sliced |
| Period 2 AI Analysis | Resume parsing, JD parsing, match scoring, strengths, missing skills, and AI readiness. | sliced |
| Period 3 Improvement Outputs | Resume suggestions, Truth Guard, Markdown draft, 4-week roadmap, and interview prep. | sliced |
| Period 4 SaaS Polish | Tracker, contact surfacing, pricing placeholder, settings, landing page, empty/error/loading states, and demo flow. | sliced |
| Period 5 UI/UX And Validation Rework | Design-system consistency, required validation, field feedback, responsive navigation, copy cleanup, and visual QA. | sliced |
| Period 6 Job URL And Profile Automation | Firecrawl-backed job URL intake, manual fetch fallback, resume-based candidate profile autofill, and provider safety boundaries. | sliced |
| Period 7 Design System Overhaul | Brand, tokens, typography, primitives, app shell, landing, light/dark parity across all surfaces. | implemented |
| Period 8 AI Assistant Intelligence Overhaul | Replace deterministic analysis with real AI (Gemini + fallback); add cover letter, insight card, dashboard summary, AI activity feed, and workflow panel on a shared backend AI-workflow foundation. | sliced |
| Period 9 AI Draft CV Export | Truth-guarded structured draft CV generation (enhancement-protocol prompt + server guards), review/approval flow, and on-demand ATS-safe PDF/DOCX export rendered in the backend. | implemented |
| Period 10 Draft CV Rendering Rework | Deterministic page-count policy clamping the model's recommendation, vendored embedded Unicode font profiles, page-aware layout configs, selection-only deterministic compression with a protected floor + report, and a bounded user page override. | implemented |

## Period 8 Epics (AI Overhaul)

Maps `applywise_ai_assistant_update_tasks.md` features to stories. See
`docs/stories/period-8/README.md` and `docs/decisions/0012-ai-workflow-standards.md`.

| Epic | Features | Stories |
| --- | --- | --- |
| AI Workflow Foundation | Feature 12 | US-027 |
| Epic 1 AI Match Intelligence | Features 1, 2, 8 | US-028, US-029, US-030 |
| Epic 2 AI Application Materials | Features 3, 4, 5 | US-031, US-032, US-033 |
| Epic 3 AI Career Improvement | Features 6, 7 | US-034, US-035 |
| Epic 4 AI Assistant Experience | Features 9, 10, 11 | US-036, US-037, US-038 |

## Period 9 Epic (Draft CV Export)

Maps the Period 9 brief (`docs/stories/period-9/brief.md`) to stories. See
`docs/stories/period-9/README.md` (including the adversarial restatements
table) and `docs/decisions/0013-draft-cv-export-architecture.md`.

| Epic | Brief area | Stories |
| --- | --- | --- |
| Draft CV Generation | Protocol, JSON schema, `draft_cvs`, endpoints | US-039 |
| Draft CV Review | Review/approval UI, versions, entry points | US-040 |
| Draft CV Export | Standard template + PDF, then DOCX | US-041, US-042 |

## Period 10 Epic (Draft CV Rendering Rework)

Maps the Period 10 brief (`docs/stories/period-10/brief.md`) to stories. See
`docs/stories/period-10/README.md` (adversarial restatements #1–#15) and
`docs/decisions/0014-draft-cv-rendering-rework.md`. Strict order:
US-043 → US-044 → US-045 → US-046.

| Epic | Brief area | Stories |
| --- | --- | --- |
| Rendering Recommendation | §1 §2 §8: recommendation object, page policy, storage | US-043 |
| Font System | §3 §6: font profiles, embedded fonts, DOCX mapping, fallback | US-044 |
| Page-Aware Export | §4 §5 §8: render configs, compression, measure loop, override | US-045 |
| Rendering UI | §7: recommendation panel, override control, copy | US-046 |

## Sliced Stories

| Story | Title | Lane | Status |
| --- | --- | --- | --- |
| US-001 | User Sign Up And Login | high-risk | implemented |
| US-002 | Dashboard Shell | normal | implemented |
| US-003 | Create User Career Profile | normal | implemented |
| US-004 | Add Or Import Resume Content | high-risk | implemented |
| US-005 | Add Job Description Manually | normal | implemented |
| US-006 | Save Contact Information | normal | implemented |
| US-007 | Generate Match Analysis | high-risk | implemented |
| US-008 | Generate Safe Resume Suggestions | high-risk | implemented |
| US-009 | Generate Markdown Tailored Resume Draft | high-risk | implemented |
| US-010 | Generate 4-Week Improvement Roadmap | high-risk | implemented |
| US-011 | Generate Interview Prep Suggestions | high-risk | implemented |
| US-012 | Application Tracker Status Workflow | high-risk | implemented |
| US-013 | Period 4 SaaS Polish And Demo Flow | high-risk | implemented |
| US-014 | Design System And UI Audit Rework | high-risk | implemented |
| US-015 | Form Validation And Feedback Rework | high-risk | implemented |
| US-016 | Core Workflow Responsive UX Rework | high-risk | implemented |
| US-017 | Accessibility Copy And Visual QA Pass | normal | implemented |
| US-018 | Add Job By URL With Fetcher | high-risk | implemented |
| US-019 | Resume PDF Text To Candidate Profile Autofill | high-risk | implemented |
| US-020 | Career Profile View/Edit Mode | normal | implemented |
| US-021 | Design Tokens And Theming Foundation (light + dark) | normal | implemented |
| US-022 | Core UI Primitives And Brand Refresh | normal | implemented |
| US-023 | App Shell And Responsive Navigation | normal | implemented |
| US-024 | Brand Landing And Pricing Pages | normal | implemented |
| US-025 | Workspace Page Sweep | normal | implemented |
| US-026 | Motion, State, Accessibility, And Dual-Theme QA | normal | implemented |
| US-027 | AI Workflow Infrastructure And Standards | high-risk | implemented (migrations applied + live backend run verified; browser E2E pending) |
| US-028 | AI Match Analyzer | high-risk | implemented (migrations applied + live backend run verified; browser E2E pending) |
| US-029 | AI Missing Skill Analysis | normal | implemented (backend + web + unit tests; migration 0012 applied + REST-reachable; browser E2E pending) |
| US-030 | Job Assistant Insight Card | normal | implemented (backend + web + unit tests; migration 0013 applied + REST-reachable; browser E2E pending) |
| US-031 | AI Tailored Resume Suggestions + Truth Guard | high-risk | implemented (backend + web Truth Guard review + strategy/keywords/claims; unit tests; browser E2E pending) |
| US-032 | AI Tailored Resume Markdown Draft | normal | implemented (backend + web rewired to AI; reuses resume_versions; unit tests; browser E2E pending) |
| US-033 | AI Cover Letter Generation | high-risk | implemented (backend + new cover-letter page; migration 0014 applied + REST-reachable; unit tests; browser E2E pending) |
| US-034 | AI 4-Week Improvement Roadmap | normal | implemented (packet) |
| US-035 | AI Interview Prep | normal | implemented (packet) |
| US-036 | Dashboard AI Summary | normal | implemented (packet) |
| US-037 | AI Activity Feed Descriptions | normal | implemented (packet) |
| US-038 | AI Workflow Panel | normal | implemented (packet) |
| US-039 | Draft CV Generation Workflow & Data Model | high-risk | implemented (packet) |
| US-040 | Draft CV Review & Approval UI | normal | implemented (packet) |
| US-041 | ATS Resume Template & PDF Export | high-risk | implemented (packet) |
| US-042 | Draft CV DOCX Export | normal | implemented (packet) |
| US-043 | Draft CV Rendering Recommendation & Page-Count Policy | high-risk | implemented |
| US-044 | Draft CV Font Profiles & Embedded Unicode Font Rendering | high-risk | implemented |
| US-045 | Draft CV Page-Aware Layout & Deterministic Compression | high-risk | implemented |
| US-046 | Draft CV UI: Rendering Recommendation & Page Override | normal | implemented |

All Period 8 stories now have full packets under `docs/stories/period-8/`
(high-risk folders for US-027/US-028/US-031/US-033; flat files otherwise) plus
per-story dev-flow docs under `docs/stories/period-8/flows/`.

**Status source of truth is the durable matrix** (`scripts/bin/harness-cli query
matrix`), not this table. The Status column above is **derived** from the
matrix — do not hand-edit it. Regenerate it instead:

```bash
scripts/sync-backlog.sh --check   # report any drift (exit 1 if out of sync)
scripts/sync-backlog.sh --write   # rewrite statuses from the matrix
```

`--write` updates only the leading status keyword and preserves annotations
(e.g. `implemented (E2E pending)`). If the two ever disagree, the matrix wins.
Harness status values are `planned → in_progress → implemented` (there is no
"completed"; `implemented` is the terminal state). As of 2026-06-09:
US-001–US-042 are `implemented`. Period 9 (US-039–US-042) shipped backend + web
with unit + integration proof; packets under `docs/stories/period-9/` (high-risk
folders for US-039/US-041; flat files otherwise). Remaining suite-wide gaps:
browser E2E, live-DB migration apply, and open-in-viewer platform checks.
