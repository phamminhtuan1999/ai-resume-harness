# Product Docs

This directory contains the living ApplyWise product contract derived from
`SPEC.md`.

`SPEC.md` remains the original input material. Ongoing work should update these
smaller product docs instead of extending the monolithic spec.

Current product docs:

- `overview.md`: product positioning, target user, modules, surfaces, and
  navigation.
- `mvp-scope.md`: MVP inclusions, exclusions, periods, and pricing placeholder
  rules.
- `architecture.md`: selected stack, boundary rules, runtime responsibilities,
  and verification ladder.
- `data-model.md`: accepted table contract and ownership rules.
- `ai-workflows.md`: AI parser, match, Truth Guard, roadmap, and interview prep
  rules.
- `ui-ux-quality.md`: design read, UI consistency, validation, state, copy, and
  visual QA rules.

## Update Rule

When behavior changes:

1. Update the affected product doc.
2. Record a decision under `docs/decisions/` if the change affects architecture,
   scope, risk, or a previously settled product rule.
