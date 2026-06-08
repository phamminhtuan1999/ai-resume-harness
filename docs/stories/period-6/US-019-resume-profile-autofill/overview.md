# Overview

## Current Behavior

ApplyWise can import resume files into canonical text and the user can manually
edit a small career profile. The system does not yet use extracted resume text
to generate a full candidate profile draft for review.

## Target Behavior

When a user uploads a resume PDF and ApplyWise has extracted canonical resume
text, the user can run profile extraction. The API generates structured
candidate profile JSON, the web app auto-fills a reviewable profile form, and
the confirmed result becomes the active candidate profile.

## Affected Users

- Software engineers who want to avoid manually filling profile details already
  present in their resume.
- Demo reviewers validating AI-assisted onboarding.
- Developers building schema-validated AI extraction.

## Affected Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`

## Non-Goals

- Do not save guessed facts.
- Do not overwrite active profile data without user review.
- Do not extract from raw binary PDFs directly in this story; use existing
  canonical resume text output.
