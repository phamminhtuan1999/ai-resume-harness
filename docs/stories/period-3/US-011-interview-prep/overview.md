# US-011 Generate Interview Prep Suggestions

## Status

implemented

## Current Behavior

Users can generate match analysis, safe resume suggestions, Markdown resume
drafts, and a 4-week roadmap from a saved match. There is no interview prep
output yet.

## Target Behavior

Authenticated users can generate interview preparation suggestions for a saved
match. The output is grounded in resume, job, missing skills, strengths,
weaknesses, and risks. Unsupported topics must be framed as study or proof to
build, not as experience the user already has.

## Affected Users

- Authenticated job seekers preparing for an AI engineering interview.

## Affected Product Docs

- `docs/product/mvp-scope.md`
- `docs/product/ai-workflows.md`
- `docs/product/data-model.md`

## Non-Goals

- AI mock interview chat.
- Voice interview.
- Calendar scheduling or external interview tools.
- Claiming experience that is not supported by resume evidence.
