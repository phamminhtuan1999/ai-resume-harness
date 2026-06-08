# UI, UX, And Validation Quality

## Design Read

ApplyWise is a B2B SaaS product workspace for job seekers making repeated,
high-stakes decisions. Protected workspace pages must stay quiet, trustworthy,
and task-focused: dense enough for comparison and review. Public pages
(landing, pricing, auth) are brand-led and may be more expressive to earn trust
before sign-up. Decision `docs/decisions/0011-design-system-overhaul.md` sets the
current visual direction and supersedes the conservative direction in US-014.

Design dials (Period 7 overhaul, see decision 0011):

- Design variance: 7. A distinct, ownable brand. Public pages use varied,
  asymmetric, brand-led composition; protected pages stay calmer (effective
  variance ~5) to protect scanning.
- Motion intensity: 4. CSS-driven motion for feedback, loading, state changes,
  and tasteful entrance/scroll reveals on public pages. Every animation must be
  motivated and must honor `prefers-reduced-motion`. No animation-runtime
  dependency is added at this level.
- Visual density: 5. Workspace pages remain scannable for repeated use; public
  pages breathe more.

## Design System

- Brand accent: emerald / teal (≈ `oklch(0.60 0.13 165)`), locked as the single
  accent across all light and dark surfaces. No second accent color.
- Neutrals: one cool-gray family; no warm/cool drift within a page.
- Typography: a real self-hosted system via `next/font` — Geist for UI and body,
  Geist Mono for numerals and metadata, and a display family for headlines, on a
  distinct display / heading / body / caption scale.
- Theme parity: light and dark are first-class. Every token has a tested dark
  value, and a page picks one theme without inverting mid-scroll.
- Shape: one corner-radius scale for cards, buttons, inputs, alerts, and popups.
- Brand mark: a simple geometric logo, not a generic stock glyph.
- Public landing and pricing avoid div-based fake product screenshots,
  decorative grid lines, equal-card feature rows, and fabricated testimonials or
  metrics. Use real component previews and honest copy.

## Quality Contract

All product surfaces must follow these rules:

- Use one theme and one accent language across public and protected pages.
- Use the emerald / teal brand accent as the single locked accent; do not
  introduce a second accent in any section (decision 0011).
- Keep one corner-radius system for cards, buttons, inputs, alerts, and popups.
- Keep page headings, section headings, and compact panel headings on distinct
  type scales.
- Avoid visible instructional copy that describes the UI itself.
- Re-read every visible string before release and fix typos, grammar issues,
  inconsistent capitalization, and unclear labels.
- Use icons only where they make repeated actions easier to scan.
- Do not hide required workflow steps inside decorative cards or generic
  placeholders.

## Form Contract

All create/update forms must provide:

- Visible labels above inputs. Placeholders may provide examples but must not be
  the only label.
- Required fields marked consistently in label or helper text.
- Client constraints for required values, URL, email, length, file type, and file
  size where applicable.
- Server validation for the same constraints.
- Field-level error rendering for validation errors that map to one field.
- A form-level alert for cross-field or persistence errors.
- Success feedback through the shared alert/popup pattern.
- Create flows that return to the list or destination view after the user has
  seen success feedback.
- Disabled and pending states that prevent duplicate submissions.

## State Contract

Every major page must intentionally handle:

- Loading states shaped like the final layout, not generic spinners.
- Empty states with a direct next action.
- Error states with a recovery action or clear next step.
- Success states that confirm what changed.
- Mobile and desktop responsive layouts with no text overlap, button wrapping,
  or horizontal overflow.

## Validation Proof

UI and validation stories must include proof from:

- Unit tests for validation helpers and field error mapping.
- Integration tests for server action validation and redirects.
- Browser verification for the primary create/update flows.
- Desktop and mobile screenshots for the changed surfaces.
- Console/log inspection for client errors during the verified flows.
