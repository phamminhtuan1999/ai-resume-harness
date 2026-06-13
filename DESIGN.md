---
name: ApplyWise
description: AI career copilot for engineers moving into AI roles — honest fit verdicts, evidence first.
colors:
  grounded-emerald: "oklch(0.62 0.132 167)"
  emerald-ink: "oklch(0.48 0.106 164)"
  on-emerald: "oklch(0.99 0.012 160)"
  emerald-wash: "oklch(0.95 0.03 168)"
  cool-canvas: "oklch(0.985 0.004 200)"
  surface-white: "oklch(1 0 0)"
  ink: "oklch(0.205 0.012 235)"
  ink-muted: "oklch(0.475 0.022 235)"
  hairline: "oklch(0.905 0.007 220)"
  verdict-success: "oklch(0.55 0.12 164)"
  verdict-warning: "oklch(0.74 0.135 76)"
  verdict-risk: "oklch(0.585 0.218 25)"
  verdict-info: "oklch(0.55 0.11 238)"
typography:
  display:
    fontFamily: "Sora, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Sora, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: "0.42rem"
  md: "0.56rem"
  lg: "0.7rem"
  xl: "0.98rem"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  2xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.emerald-ink}"
    textColor: "{colors.on-emerald}"
    rounded: "{rounded.lg}"
    height: "2.25rem"
    padding: "0 0.875rem"
  button-outline:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "2.25rem"
    padding: "0 0.875rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "2.25rem"
    padding: "0 0.875rem"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "2.25rem"
    padding: "0.25rem 0.75rem"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  badge-success:
    backgroundColor: "{colors.emerald-wash}"
    textColor: "{colors.emerald-ink}"
    rounded: "{rounded.lg}"
    height: "1.25rem"
    padding: "0.125rem 0.5rem"
---

# Design System: ApplyWise

## 1. Overview

**Creative North Star: "The Second Opinion"**

ApplyWise looks and behaves like a trusted expert review — a specialist walking
you through findings. The verdict comes first in plain language, the evidence
sits directly beneath it, and the mechanics stay behind an Advanced tab. Nothing
on screen performs enthusiasm; the interface earns trust the way a good second
opinion does: calm, specific, and willing to say "not yet." The personality is
**quiet precision** — compact 36px controls, hairline structure, a 14px working
body size, and one emerald accent that only appears where it carries meaning.

The system runs on a single cool-gray neutral family with a faint green cast
and one brand accent, Grounded Emerald, locked across light and dark (decision
0011). Public marketing pages may use the brand boldly (radial emerald washes,
display-scale Sora); inside the workspace the accent recedes to verdicts, CTAs,
progress, and the active nav marker. Light and dark have full token parity —
dark is a deep cool near-black, never pure black, and no section inverts
mid-page.

This system explicitly rejects: generic shadcn defaults, landing-page AI tells
(div-based fake screenshots, decorative grid lines, four-equal-feature-card
grids, gradient-text headlines), score-dashboard machismo (big numeric
percentages leading a screen), and resume-mill cheerfulness.

**Key Characteristics:**
- Decision-first hierarchy: verdict → evidence → mechanics, on every surface.
- One accent, earned: emerald means verdict, action, progress — never décor.
- Border-first structure: 1px rings and hairlines; shadows are ambient whispers.
- Dense, scannable workspace: tables over card grids, 36px controls, 14px body.
- Two-face typography: Sora for page titles and hero moments, Geist everywhere else.
- Full light/dark parity; CSS-only motion, gated by `prefers-reduced-motion`.

## 2. Colors

A restrained palette: one cool-gray neutral family, one emerald accent, and a
four-color verdict vocabulary — every hue on screen is doing a job.

### Primary
- **Grounded Emerald** (`oklch(0.62 0.132 167)`): the brand voice. Active nav
  marker, progress fills, links, focus rings, and the marketing radial wash.
  In dark mode it brightens to `oklch(0.72 0.142 166)` and becomes the button
  fill itself.
- **Emerald Ink** (`oklch(0.48 0.106 164)`): the primary button fill in light
  mode — deep enough to carry white text at AA+. Hover darkens it a further 9%.
- **On Emerald** (`oklch(0.99 0.012 160)`): text/icons on emerald fills.
- **Emerald Wash** (`oklch(0.95 0.03 168)`): the quiet tint for selected/active
  states (sidebar active background, accent chips). Dark equivalent:
  `oklch(0.30 0.05 168)`.

### Neutral
- **Cool Canvas** (`oklch(0.985 0.004 200)`): the app background. A true
  near-white with a whisper of cool green — not cream, not gray. Dark:
  `oklch(0.17 0.012 235)`.
- **Surface White** (`oklch(1 0 0)`): cards, inputs, popovers. Dark surfaces
  sit one step lighter than the canvas (`oklch(0.208 0.014 234)`).
- **Ink** (`oklch(0.205 0.012 235)`): body and heading text. Dark:
  `oklch(0.955 0.005 210)`.
- **Ink Muted** (`oklch(0.475 0.022 235)`): descriptions, metadata, table
  captions. Dark: `oklch(0.705 0.018 220)`.
- **Hairline** (`oklch(0.905 0.007 220)`): borders, dividers, card rings. In
  dark mode borders become white-alpha (`oklch(0.93 0.01 210 / 11%)`).

### Tertiary (verdict vocabulary)
- **Verdict Success** (`oklch(0.55 0.12 164)`): "Strong Apply Target" — note it
  shares the brand hue; success and the brand speak with one voice.
- **Verdict Warning** (`oklch(0.74 0.135 76)`): "Apply With Improvements",
  stale-analysis and needs-review states.
- **Verdict Info** (`oklch(0.55 0.11 238)`): "Learning Target" and neutral
  informational states.
- **Verdict Risk** (`oklch(0.585 0.218 25)`): destructive actions and failed
  states. Used as a 10–20% tint with colored text, not a solid fill, except on
  confirmed-destructive buttons. "Not Recommended Yet" deliberately wears
  muted gray instead — the verdict recommends, it never closes the door.

### Named Rules
**The Earned Emerald Rule.** Emerald appears only where it means something — a
verdict, a primary action, progress, the active nav item. It never decorates.
On a workspace screen the accent covers well under 10% of the surface; if a
screen feels emerald-heavy, something is using the brand that shouldn't be.

**The One Voice Rule.** One accent, both themes. No secondary accent color may
be introduced; new semantic needs must map onto the existing verdict vocabulary
(success / warning / info / risk) or stay neutral.

## 3. Typography

**Display Font:** Sora (weights 500–700, fallback Geist → system sans)
**Body Font:** Geist (fallback system sans)
**Mono Font:** Geist Mono (tabular figures for data and metadata)

**Character:** A geometric display voice over a quiet, technical workhorse.
Sora gives page titles and hero moments a confident, slightly rounded
authority; Geist keeps the working surfaces dense and neutral. The pairing
contrast is deliberate — hierarchy comes from the face switch, not from size
inflation.

### Hierarchy
- **Display** (Sora 600, `clamp(2.25rem, 5vw, 3.75rem)`, line-height 1.1,
  tracking -0.025em): marketing heroes only (`text-4xl md:text-6xl`). Always
  `text-balance`.
- **Headline** (Sora 600, 1.5rem–1.875rem, tracking -0.025em): app page titles
  (1.5rem via PageHeader) and marketing section heads (1.875rem).
- **Title** (Geist 500, 1rem, line-height snug): card and section titles. Geist,
  not Sora — cards stay quiet.
- **Body** (Geist 400, 0.875rem, line-height 1.5rem): the working text size
  everywhere in the app. Descriptions and prose cap at `max-w-2xl` (~65ch).
- **Label** (Geist 500, 0.75rem): badges, eyebrows, table headers, metadata.
  Sentence case — never uppercase-tracked.

### Named Rules
**The Sora Ceiling Rule.** Sora is reserved for page titles and hero moments.
Card titles, section titles, and everything inside the working surface stay on
Geist. If Sora appears below an `h1` in the workspace, it's a violation.

**The Tabular Numbers Rule.** Scores, credits, dates, and any column of figures
render with tabular lining numerals (`tabular-nums` or Geist Mono) so digits
align. A jittering number column is a bug.

## 4. Elevation

Structure comes from borders, not shadows. Cards are defined by a 1px hairline
ring (`ring-1 ring-border`) over distinct surface tones; shadows exist only as
ambient whispers in light mode and **disappear entirely in dark mode**, where
depth is conveyed by tonal layering (canvas `0.17` → surface `0.208` →
secondary `0.262`). Hovering a primary button deepens its tinted shadow
slightly; nothing else lifts.

### Shadow Vocabulary
- **Ambient rest** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px
  rgb(0 0 0 / 0.10)` — Tailwind `shadow-sm`): cards and inputs at rest. On
  outline buttons it drops to a near-invisible `shadow-black/[0.02]`.
- **Brand emphasis** (`shadow-sm` tinted `shadow-primary/25`): the primary
  button's resting glow; hover steps it to `shadow-md` at the same tint.

### Named Rules
**The Border-First Rule.** If a container needs definition, reach for the
hairline ring and a surface-tone step — never a heavier shadow. Dark mode is
the test: a component that still reads as structured with all shadows removed
is correct; one that depends on its shadow is wrong.

## 5. Components

Component character: **quiet precision** — calm, dense, exact. Controls share a
36px height rhythm, the 0.7rem base radius, a 150ms `ease-out-quint`
transition, and a 3px soft focus ring. The UI recedes so the evidence reads.

### Buttons
- **Shape:** gently rounded (0.7rem radius; sm/xs sizes step to 0.56rem),
  36px default height, 14px medium text.
- **Primary:** Emerald Ink fill, On Emerald text, tinted resting shadow
  (`shadow-primary/25`). Hover mixes 9% black into the fill and deepens the
  shadow; active presses down 1px (`translate-y-px`). In dark mode the fill
  inverts to bright emerald with dark ink and the shadow is removed.
- **Outline:** Surface White with hairline border — the default secondary
  action. Hover fills with muted gray.
- **Ghost / Secondary:** transparent or `secondary` gray fills for tertiary
  actions; hover raises to muted.
- **Destructive:** risk-red at a 10% tint with red text (not a solid red
  fill); hover deepens to 18%.
- **Warning:** verdict-warning at a 16% tint with darkened same-hue text
  (mirrors the warning chip) — for cautionary-but-recoverable commits like
  "Generate anyway"; destructive stays reserved for actual destruction.
- **Focus:** 3px ring at 45% ring-color opacity plus ring-colored border —
  same treatment across all variants.

### Chips (badges)
- **Style:** 20px tall, 12px medium text, 0.7rem radius, sentence case.
- **Verdict variants:** soft tints with darkened same-hue text — success
  `bg-success/12`, warning `bg-warning/16`, info `bg-info/12`, risk
  `bg-destructive/10` — each with a hand-tuned dark-mode pair. The verdict
  badge is the loudest color moment a table row gets.

### Cards / Containers
- **Corner Style:** 0.7rem radius.
- **Background:** Surface White over Cool Canvas (one tonal step apart).
- **Border:** 1px hairline ring (`ring-1 ring-border`).
- **Shadow Strategy:** ambient rest only (see Elevation); none in dark.
- **Internal Padding:** 1rem (`--card-spacing`), 0.75rem for `size="sm"`;
  footers sit on a `muted/50` band behind a top hairline.
- Cards are containers for grouped evidence, not a default wrapper — index
  pages use tables, not card grids.

### Inputs / Fields
- **Style:** 36px, Surface White, 1px `input` border, 0.7rem radius,
  near-invisible ambient shadow; placeholder in Ink Muted.
- **Focus:** border takes the ring color plus a 3px soft ring at 35% opacity —
  a glow, not a jump.
- **Error:** destructive border with a 20% destructive ring (40% in dark).
- **Disabled:** 50% opacity, cursor blocked, no pointer events.

### Navigation
- **Sidebar:** its own near-canvas surface with hairline divider. Items are
  36px rows, 14px medium, Ink Muted at rest; hover raises to `accent/70`.
  The active item carries an Emerald Wash fill, emerald icon, and a 4px
  rounded brand bar on the left edge — the one sanctioned stripe in the
  system. `aria-current="page"` always set.
- **Mobile:** the sidebar collapses to a sheet-style mobile nav below `lg`;
  same item vocabulary.

### Signature Component: the Decision Header
The product's defining pattern (US-048): a verdict badge in plain language
("Strong Apply Target"), a one-line qualitative confidence statement, then
supporting evidence in labeled sections — score breakdown first as the
at-a-glance summary, matched/missing lists as its detail. Numeric percentages
never lead; they live in Advanced. Every negative finding ships with its next
step (e.g. "I have this — add it to my profile").

## 6. Do's and Don'ts

### Do:
- **Do** lead every analysis surface with the verdict in plain language, then
  evidence, then mechanics — in that order (decision-first hierarchy).
- **Do** pair every negative state with a recoverable next step: a gap links to
  the profile, a failure offers Refresh, a "not yet" points to the roadmap.
- **Do** use tables for index/history pages (matches, jobs, tracker) — dense,
  scannable rows with verdict badges, not card grids.
- **Do** keep both themes in lockstep: every new token needs a tested dark
  value; dark drops shadows and relies on tonal steps (0.17 → 0.208 → 0.262).
- **Do** gate all motion behind `prefers-reduced-motion` with the final visible
  state as the default — content must never depend on an animation firing.
- **Do** hold the 36px control rhythm, 0.7rem radius, 150ms `ease-out-quint`
  transitions, and the 3px soft focus ring on every new control.
- **Do** aim for WCAG AAA contrast (7:1 body text) on new and reworked
  surfaces; AA is the enforced floor.

### Don't:
- **Don't** ship generic shadcn defaults — the gray-on-white sameness was
  explicitly rejected as "not strong enough for a commercial SaaS launch"
  (decision 0011 / PRODUCT.md).
- **Don't** use landing-page AI tells: div-based fake product screenshots,
  decorative grid lines, four-equal-feature-card grids, or gradient-text
  headlines (`background-clip: text` is banned outright).
- **Don't** lead with score-dashboard machismo — big numeric percentages and
  confidence meters at the top of a screen. Numbers are supporting detail
  behind the qualitative verdict (US-048).
- **Don't** write resume-mill cheerfulness into the UI: no hype copy, no false
  encouragement, no claim the data can't back (Truth Guard applies to copy).
- **Don't** introduce a second accent hue or use emerald decoratively — see
  The Earned Emerald Rule and The One Voice Rule.
- **Don't** put colored side-stripes on cards, list items, callouts, or alerts.
  The 4px active-nav bar in the sidebar is the single sanctioned exception.
- **Don't** use uppercase-tracked eyebrow labels above sections; labels are
  sentence case at 12px medium.
- **Don't** use Sora below the page-title level, inflate display type past
  3.75rem, or track tighter than -0.04em.
- **Don't** reorder the six-tab analysis shell or the sidebar between jobs,
  verdicts, or sessions — spatial memory is part of the product's calm.
