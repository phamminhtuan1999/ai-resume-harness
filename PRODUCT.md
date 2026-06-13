# Product

## Register

product

## Users

Software engineers with roughly 2–6 years of experience (backend, full-stack,
frontend, QA automation, cloud, or enterprise software) transitioning toward
AI-focused engineering roles in the US market (AI Engineer, Applied AI
Engineer, LLM Engineer, GenAI Engineer). They are technical, time-pressed, and
mid-job-search: evaluating specific job postings, deciding where to invest
application effort, and closing skill gaps. The job to be done on any given
screen is a decision — "apply now or improve first?" — followed by the concrete
next action (fix the resume, learn the skill, prep the interview).

## Product Purpose

ApplyWise is an AI-powered career copilot that analyzes resume-to-job fit and
answers one question repeatedly: **apply now or improve first?** It does not
simply rewrite resumes — it explains what is missing, what can be improved
honestly (Truth Guard: no fabricated claims), and what the candidate should
build or learn before applying. Core surfaces: a decision-first job analysis
(`/matches/:id`) leading with a single verdict and evidence, a tailored CV
generator with ATS-safe export, skill-gap roadmaps, interview prep, an
application tracker, and prepaid credit billing for paid AI workflows. Success
looks like a user who trusts the verdict enough to act on it — including when
the verdict is "not yet."

## Brand Personality

**Honest coach.** Candid, evidence-based, calm confidence. Three words:
honest, grounded, supportive. The product earns trust by telling users
"improve first" when that's the truth, and by showing its evidence rather than
asserting scores. Tone is plain-language and decision-first: verdict, then
why, then what next. Numeric scores and model internals are deliberately
de-emphasized (kept behind the Advanced tab); qualitative, human explanations
lead. Never hype, never flattery, never false encouragement.

## Anti-references

- **Generic shadcn defaults** — the pre-Period-7 UI was explicitly rejected as
  "not strong enough for a commercial SaaS launch" (decision 0011). No
  default-token gray-on-white sameness.
- **Landing-page AI tells** — div-based fake product screenshots, decorative
  grid lines, four-equal-feature-card grids, gradient-text headlines.
- **Score-dashboard machismo** — products that lead with big numeric
  percentages and confidence meters. ApplyWise leads with the decision in
  plain language; numbers are supporting detail (US-048).
- **Resume-mill cheerfulness** — services that promise every job is within
  reach. ApplyWise's value is honest triage, not motivation theater.

## Design Principles

1. **Decision first, evidence second, mechanics last.** Every analysis surface
   leads with the verdict in plain language, supports it with evidence, and
   keeps model/workflow internals behind Advanced. The hierarchy of a screen
   mirrors the hierarchy of the user's decision.
2. **Earn trust by showing work.** Strengths, gaps, and risks are always
   traceable to evidence ("what matches" / "what's missing"), never bare
   assertions. Truth Guard applies to UI copy too: no claim the data can't back.
3. **Stable shell, scannable workspace.** The six-tab analysis shell never
   reorders between jobs or verdicts; the sidebar nav is constant. Users build
   spatial memory; the product rewards it. Workspace pages stay dense and
   scannable (tables over card grids for index pages).
4. **The honest path is recoverable.** Bad news always ships with a next step:
   a gap links to "add it to my profile," a failed analysis offers Refresh, a
   "not recommended" verdict points to the roadmap. Never a dead end.
5. **Brand-led in public, quiet at work.** Marketing pages (/ and /pricing)
   carry the emerald brand boldly; inside the workspace the accent recedes to
   verdicts, CTAs, and progress — color means something there.

## Accessibility & Inclusion

- **Target WCAG AAA** (owner decision, 2026-06-12): aim for 7:1 contrast on
  body text and enhanced accommodations as surfaces are touched. WCAG AA is
  the enforced floor today (decision 0011 tokens were AA-tested); treat AAA as
  the bar for new and reworked surfaces rather than a retroactive blocker.
- All motion is CSS-driven and fully gated by `prefers-reduced-motion`; the
  default state of every animated element is its final visible state (decision
  0011) — content never depends on an animation firing.
- Light and dark themes have full parity; every token carries a tested dark
  value. No section inverts mid-page.
- Keyboard navigable; focus rings use the brand ring token, never suppressed.
- Tabular lining figures for data and metadata so columns of numbers scan.
