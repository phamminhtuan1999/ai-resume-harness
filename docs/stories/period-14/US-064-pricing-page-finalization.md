# US-064 Check and Finalize the Pricing Page

## Status

implemented

## Lane

normal

## Product Contract

The pricing page must be launch-ready before payment processing is enabled: it
should clearly describe the Free workspace and paid credit packs, use honest
commercial copy, show what credits unlock, work on mobile and desktop, and route
purchase actions only through the verified credit checkout path.

## Relevant Product Docs

- `docs/product/overview.md` (public pricing surface)
- `docs/product/mvp-scope.md` (current pricing placeholder rule)
- `docs/product/ui-ux-quality.md`
- `docs/stories/period-14/README.md`

## Acceptance Criteria

- Pricing copy clearly distinguishes Free and Pro without fabricated metrics,
  fake testimonials, or unsupported guarantees.
- Credit pack comparison lists credits, price, recommended use case, and what
  paid AI workflows cost in user-facing language.
- CTA behavior is explicit for the current launch state:
  - when Stripe env vars are missing, purchase controls are disabled with setup
    pending copy;
  - when US-065 is configured, purchase controls route only to the tested
    checkout entry.
- Public navigation from landing page and app shell still reaches `/pricing`.
- Light and dark themes pass visual QA at mobile and desktop widths.
- The page has static tests proving it does not accidentally introduce checkout
  before payment processing is complete.

## Design Notes

- UI surface: `apps/web/src/app/pricing/page.tsx`.
- Related public surface: `apps/web/src/app/page.tsx`.
- Keep page content dense enough for comparison; avoid a marketing-only hero
  that hides the plans below the fold.
- Do not collect card details or create subscriptions in this story.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Static/page-content tests for honest copy, plan limits, and no premature checkout wiring. |
| Integration | Not required unless pricing data is moved behind a route or server action. |
| E2E | Browser checks for `/pricing`, landing-page CTA to pricing, and app-shell pricing navigation. |
| Platform | Desktop and mobile screenshots in light and dark. |

## Harness Delta

This story creates the explicit post-MVP pricing-finalization task requested
after the original MVP placeholder shipped.

## Evidence

Started 2026-06-12.

- `/pricing` now shows Free plus Starter, Builder, and Pro credit packs.
- Purchase controls post to the credit checkout server action when Stripe env
  vars are configured and show `Setup pending` locally when they are absent.
- After `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` were added,
  `/pricing` returned 200 from the local dev server and rendered enabled
  `Buy $9`, `Buy $19`, and `Buy $39` controls.
- Public `/pricing` now bypasses Clerk middleware while protected app routes
  remain covered by `protectedRoutePatterns`.
- Unit/static proof: `npm run test --workspace apps/web` passed 252 tests.
- Lint/type/build proof: `npm run lint --workspace apps/web`,
  `apps/web/node_modules/.bin/tsc --noEmit --project apps/web/tsconfig.json`,
  and `npm run build --workspace apps/web` passed.
