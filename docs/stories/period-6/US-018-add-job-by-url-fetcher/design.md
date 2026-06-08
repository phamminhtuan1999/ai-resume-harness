# Design

## User Story

As a user, I want to paste a job URL so that ApplyWise can automatically fetch,
extract, score, and save the job.

## Acceptance Criteria

- Given I am logged in, when I paste a job URL into Add Job by URL, then the
  system attempts to fetch the job post content.
- Given the fetch succeeds, then the system extracts job title, company,
  location, work type, salary if available, responsibilities, required skills,
  preferred skills, years of experience, and raw job description.
- Given extraction succeeds, then the job is saved with source `manual_url`.
- Given the job is saved, then the system scores it against my active candidate
  profile.
- Given scoring succeeds, then the job appears in my job list with match score
  and status.
- Given the fetch fails, then I see a fallback option to paste the job
  description manually.
- Given the job URL already exists, then the system does not create a duplicate.

## Proposed API

```http
POST /api/jobs/import-url
```

Request:

```json
{
  "source_url": "https://example.com/jobs/123"
}
```

Response:

```json
{
  "job_id": "uuid",
  "source_url": "string",
  "normalized_url": "string",
  "company": "string",
  "title": "string",
  "location": "string",
  "work_type": "remote | hybrid | onsite | unknown",
  "employment_type": "full-time | contract | internship | unknown",
  "salary_range": "string | null",
  "responsibilities": ["string"],
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "required_experience_years": "string | null",
  "ai_related_requirements": ["string"],
  "cloud_requirements": ["string"],
  "raw_description": "string",
  "confidence_score": 0.0,
  "match_score": 0
}
```

## Data Model Delta

Likely `jobs` additions:

- `source text default 'manual'`
- `source_url text`
- `normalized_url text`
- `work_type text`
- `employment_type text`
- `salary_range text`
- `extraction_status text default 'not_required'`
- `extraction_confidence numeric`
- `extraction_json jsonb`

Add a user-scoped unique index on `(user_id, normalized_url)` where
`normalized_url is not null`.

## UI Contract

The `/jobs/new` surface should support two modes:

- Add by URL.
- Paste manually.

Failed URL fetches should show:

```text
We could not fetch this job page. Paste the job description manually.
```

The fallback should preserve the original URL in the manual form when possible.

## Provider Rules

- Firecrawl is the MVP fetch provider.
- Provider output is untrusted and must be parsed.
- Raw fetched content must not be logged in production.
- LinkedIn URLs are supported only when user-submitted pages are accessible to
  the approved fetch provider.
