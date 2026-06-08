# 0011 Commercial-Grade Design System Overhaul

Date: 2026-06-08

## Status

Accepted

## Context

ApplyWise reached MVP feature-completeness through Periods 1-6. The visual layer
was deliberately kept conservative: `docs/product/ui-ux-quality.md` set dials at
variance 4 / motion 2 / density 6, and `US-014` explicitly **rejected a full
redesign**, choosing consistency-only because "the existing restrained SaaS
direction is acceptable."

A stakeholder review of the shipped product found the opposite: the UI reads as
generic shadcn defaults and is not strong enough for a commercial SaaS launch.
Concrete problems: a thin brand identity (a generic `Sparkles` glyph as the
logo, the brand name used as the literal hero headline), landing-page AI tells
(a div-based fake product screenshot and decorative grid lines, four equal
feature cards), a murky low-confidence palette, a half-broken dark mode (flat
gray charts plus a stray purple sidebar), no real typographic scale, the Geist
font referenced in CSS but never actually loaded, unused loading/skeleton
states, and no mobile navigation (the sidebar simply disappears below `lg`).

The user directed a bold brand overhaul rather than another consistency pass.

## Decision

Adopt a commercial-grade design-system overhaul as a new initiative (Period 7),
foundation-first. Specifically:

- **Brand accent:** emerald / teal (≈ `oklch(0.60 0.13 165)`), locked as the
  single accent across light and dark.
- **Dials:** variance 7, motion 4, density 5 (up from 4 / 2 / 6). Protected
  workspace pages stay scannable; public pages become brand-led.
- **Theme parity:** rebuild light and dark together; every token carries a
  tested dark value. No section inverts mid-page.
- **Typography:** self-host a real font system via `next/font` — Geist (UI and
  body), Geist Mono (numerals and metadata), and a display family (Sora) for
  headlines. Establish a true display/heading/body/caption scale.
- **Motion:** CSS-driven only (transitions, keyframes via `tw-animate-css`, and
  CSS scroll-driven animations), gated by `prefers-reduced-motion`. No new
  animation runtime (Motion/GSAP) is added at this dial level.
- **Preserve:** all routes, information architecture, navigation labels,
  content, and form-field names/order (analytics and autofill safety).

This decision **supersedes the visual direction of US-014**; US-014's
consistency goals are absorbed into the new token and primitive layer.

## Alternatives Considered

1. **Consistency-only (US-014 direction).** Rejected: does not meet the
   commercial-launch bar the review identified.
2. **Elevate within the restrained contract (variance ~5).** Rejected in favor
   of a bolder direction per explicit user choice.
3. **Add a Motion or GSAP runtime.** Deferred: CSS is sufficient at motion 4 and
   keeps the workspace bundle lean. Revisit only if a specific interaction needs
   physics.
4. **Light-only now, dark later.** Rejected: the audience is engineers who live
   in dark mode, and a half-broken dark theme actively hurts the commercial
   goal.

## Consequences

Positive:

- A distinct, ownable brand instead of template defaults.
- A real, self-hosted typographic system (fixes the unloaded-font bug).
- A working, consistent dark mode at parity with light.
- Fixed responsive navigation (mobile drawer).
- An anti-slop landing page free of fake-screenshot and grid-line tells.

Tradeoffs:

- Larger QA surface: every surface verified in both themes and at reduced
  motion.
- The product UI/UX contract (`docs/product/ui-ux-quality.md`) is rewritten.
- Broad blast radius across shared tokens and primitives; sequenced
  foundation-first to contain risk and allow review before the page sweep.

## Follow-Up

- Update `docs/product/ui-ux-quality.md` (dials, palette, theme parity, motion)
  and add the Period 7 row to `docs/product/mvp-scope.md`.
- Execute Period 7 stories US-021 through US-026, starting with the token,
  font, primitive, app-shell, and landing foundation; pause for review before
  the remaining workspace-page sweep (US-025).
- Revisit a motion runtime only if a planned interaction needs physics beyond
  CSS.
