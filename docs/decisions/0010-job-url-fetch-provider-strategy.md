# 0010 Job URL Fetch Provider Strategy

Date: 2026-06-08

## Status

Accepted

## Context

ApplyWise now needs a job URL intake path. Users should be able to paste a job
URL from a company career page, Greenhouse, Lever, Workday, Indeed, LinkedIn, or
similar source and let ApplyWise fetch, extract, score, and save the job.

This feature touches external providers, protected user data, bot-sensitive job
boards, AI extraction, duplicate detection, scoring, and user fallback states.

## Decision

Use Firecrawl first for MVP job URL fetching.

The job URL flow is:

```text
User submits job URL
Validate URL
Normalize URL and check duplicates
Try Firecrawl scrape
Extract markdown or structured content
Run AI job extractor with a strict schema
Validate extracted job data
Save job with source manual_url
Run match scoring against the active candidate profile
Show job in the job list with match score and status
```

If Firecrawl cannot fetch the page, show a manual fallback:

```text
We could not fetch this job page. Paste the job description manually.
```

Do not use unauthorized LinkedIn scraping as the main product dependency.
ApplyWise may support user-submitted LinkedIn URLs when the approved fetch
provider can access them, but product copy should describe support as approved
job sources and user-submitted job URLs.

Browserbase is a post-MVP option for agentic browsing. Apify actors, job APIs,
and supported feeds are future discovery options.

## Alternatives Considered

1. Manual paste only. Rejected because the updated requirement asks for job URL
   intake.
2. Build a custom scraper first. Rejected because job boards vary heavily and
   this increases compliance and maintenance risk.
3. Browserbase first. Deferred because it is better for agentic navigation than
   the fastest URL-to-job MVP path.
4. Firecrawl first. Accepted because it is the fastest route to URL scraping,
   markdown cleanup, and structured extraction fallback.
5. LinkedIn scraping as a primary dependency. Rejected because it is commonly
   login-gated, bot-protected, and policy-sensitive.

## Consequences

Positive:

- Ships job URL intake faster than custom scraping.
- Keeps provider orchestration in the backend.
- Gives the UI a clear fallback when the provider cannot fetch a page.
- Avoids making unauthorized LinkedIn scraping a core dependency.

Tradeoffs:

- Firecrawl account and API key configuration are required.
- Provider outages and blocked pages must be surfaced clearly.
- AI extraction still needs strict schema validation and retry behavior.
- Duplicate detection requires durable normalized URL storage.

## Follow-Up

- Add Firecrawl environment variables and backend client wrapper.
- Add migration for job source, normalized URL, extraction metadata, and score
  display fields if existing columns are insufficient.
- Add fixture tests for company pages, Greenhouse, Lever, Workday-style pages,
  fetch failure, duplicate URL, and schema validation failure.
- Add Browserbase and Apify only as later stories when discovery workflows are
  selected.
