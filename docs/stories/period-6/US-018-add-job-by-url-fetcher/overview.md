# Overview

## Current Behavior

ApplyWise can save manually pasted job descriptions with optional job URL and
contact metadata. It does not fetch a job page from a URL or extract structured
job fields from fetched page content.

## Target Behavior

A signed-in user can paste a job URL. ApplyWise validates and normalizes the URL,
checks for duplicates, fetches the page with Firecrawl, extracts structured job
data with a strict AI schema, saves the job with source `manual_url`, scores the
job against the active candidate profile, and shows it in the jobs list with
match score and tracker status.

## Affected Users

- Job seekers who want to save a job without manually copying the description.
- Demo reviewers checking end-to-end URL intake.
- Developers configuring provider credentials and extraction fixtures.

## Affected Product Docs

- `docs/product/overview.md`
- `docs/product/mvp-scope.md`
- `docs/product/architecture.md`
- `docs/product/data-model.md`
- `docs/product/ai-workflows.md`
- `docs/decisions/0010-job-url-fetch-provider-strategy.md`

## Non-Goals

- Do not implement Browserbase agentic browsing in this story.
- Do not implement Apify/job API automatic discovery in this story.
- Do not rely on unauthorized LinkedIn scraping as a primary dependency.
- Do not auto-apply to jobs.
