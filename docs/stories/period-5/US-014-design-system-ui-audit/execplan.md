# Exec Plan

## Goal

Make the existing ApplyWise UI feel like one product system by tightening shared
visual primitives, repeated page layouts, empty states, and high-visibility
copy.

## Scope

In scope:

- Shared card, badge, table, and page-level layout patterns.
- Public landing and pricing visual consistency.
- Protected workspace page headers and empty-state patterns.
- Copy cleanup where labels are unclear or too implementation-focused.
- Browser screenshots on desktop and mobile.

Out of scope:

- Field-level form error mapping.
- Mobile navigation parity.
- Database, API, auth, AI, or billing behavior changes.

## Risk Classification

Risk flags:

- Cross-platform.
- Existing behavior.
- Multi-domain.
- Weak proof.

Hard gates:

- None for data, auth, or destructive behavior.

## Work Phases

1. Discovery: inspect current UI primitives and key surfaces.
2. Design: choose shared primitives and token adjustments.
3. Implementation: patch shared UI components and representative surfaces.
4. Verification: run web tests, lint, build, and browser desktop/mobile checks.
5. Harness update: update story proof and trace.

## Stop Conditions

Pause for human confirmation if:

- Product workflows need to change to satisfy layout goals.
- Validation requirements need to move into this story.
- A data, auth, billing, or API change appears necessary.
