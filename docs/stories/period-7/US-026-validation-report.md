# US-026 Validation Report — Motion, State, Accessibility, Dual-Theme QA

Date: 2026-06-08
Story: US-026 (Period 7 closeout)
Decision: `docs/decisions/0011-design-system-overhaul.md`

## Scope

Cross-cutting QA over the Period 7 design overhaul: every public and protected
surface, both themes, plus motion and accessibility behavior. Verified with the
test suite, a contrast computation, and Playwright screenshots driven against a
local dev server (auth temporarily disabled via a throwaway `.env.local`, removed
after each run).

## Mechanical checks

- `npm run test:web` — 58/58 pass.
- `npm run lint:web` — clean (0 errors, 0 warnings).
- `npm run build:web` — compiles, TypeScript passes, all 23 routes build.
- Browser console — 0 errors across all screenshot runs (landing, dashboard,
  resumes, jobs, matches, tracker, settings, profile, pricing, auth, forms).

## Motion (decision 0011: CSS-only, reduced-motion honored)

- Entrance (`.rise`) and scroll-reveal (`.reveal`) keyframes live inside
  `@media (prefers-reduced-motion: no-preference)`; under `reduce` they have no
  animation rule and elements render at their natural, visible state.
- Mobile-nav overlay/drawer transitions and the FAQ chevron use
  `motion-reduce:transition-none`.
- Skeleton pulse gated with `motion-reduce:animate-none`; progress fill gated
  with `motion-reduce:transition-none`.
- **Verified:** under emulated `prefers-reduced-motion: reduce`, a DOM check
  found **0** `.reveal`/`.rise` elements left below 0.5 opacity in light and
  dark. Full-page landing renders every section (no hidden content).
- Every animation is motivated (hero entrance, scroll reveal on public sections,
  drawer slide, progress fill, hover/active feedback). No infinite decorative
  loops, no marquees, no GSAP/Motion runtime added.

## Accessibility — contrast (WCAG AA)

Computed from the oklch tokens (text vs effective background):

| Pair | Light | Dark |
| --- | --- | --- |
| Body text on background | 17.1 | 16.8 |
| Muted text on background/card | 6.4–6.6 | 7.3 |
| Primary (emerald) button + its text | 6.0 | 7.9 |
| Success badge text | 7.6 | 11.5 |
| Warning badge text | 7.6 | 11.1 |
| Info badge text | 7.3 | 9.6 |
| Destructive text | 4.7 | 6.1 |

All text/control pairs pass AA (>= 4.5). `--brand` (3.25 vs background) is
reserved for icons, fills, rings, and large accents only — never small body
text — which is AA for non-text UI (>= 3).

## Accessibility — keyboard and focus

- All interactive primitives (button, input, select, links-as-buttons) share a
  token-driven `focus-visible:ring` in the brand color.
- **Verified:** text input shows a visible emerald focus ring on focus;
  keyboard `Tab` from the page body reaches the sidebar nav links. Visible focus
  confirmed by screenshot.

## Copy self-audit

- **Em-dashes / en-dashes: zero** across all `.tsx`/`.ts`/`.css` (the page-title
  metadata em-dash was fixed; a code-comment em-dash was removed).
- Internal/implementation copy removed from user-facing surfaces: `Docling`,
  `Python API`, `deterministic-baseline`, `US-004`, `Period 2`, "placeholder for
  a serious SaaS path". Replaced with plain user-facing language.
- No fabricated testimonials, metrics, or fake-precise numbers on the landing
  (the hero numbers are a labeled sample of the product UI, not product claims).

## Pre-flight slop checklist (landing + public)

- No div-based fake product screenshot (real component preview used).
- No decorative grid lines; no equal-card feature row.
- One eyebrow on the page (hero); section headers stand alone.
- No version labels, decorative status dots, scroll cues, locale/time strips, or
  section-number eyebrows.
- One emerald accent locked across all surfaces; one cool-gray neutral family;
  one corner-radius scale.
- One theme per page; no mid-page inversion. Dark mode at parity with light.

## Theme parity

Every surface verified in light and dark via screenshots: landing, pricing,
auth fallback, dashboard, resumes (+ new), jobs (+ new), matches (+ new),
tracker, settings, profile, and the loading skeleton. Dark mode shows the
emerald brand and correct neutrals with no stray hues.

## Deferred / not covered

- Match detail and the four AI sub-pages (suggestions, roadmap, interview-prep,
  resume-draft) were build- and code-verified but not screenshotted, because
  rendering them needs seeded Supabase match data. Their changes are token- and
  badge-level and share the verified primitives.
- Clerk's hosted sign-in/up widget is styled by Clerk; only the no-env fallback
  is themed by this project. Theming the Clerk widget (appearance prop) is a
  possible follow-up.
- Per-route skeletons: one shared `(app)/loading.tsx` covers all protected
  routes; route-specific skeletons could be added later for closer shaping.

## Outcome

Period 7 acceptance criteria met. The overhaul ships a token-driven emerald
design system at light/dark parity, real typography, fixed responsive
navigation, intentional states, an anti-slop landing, and a persistent app shell
with skeleton loading. No blocking issues found.
