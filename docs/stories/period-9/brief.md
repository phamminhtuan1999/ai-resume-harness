# Period 9 Source Brief — AI Draft CV Export (PDF/DOCX)

> Verbatim user-provided enhancement requirement, received 2026-06-09. This is
> **input material**, not the living contract. The accepted restatement lives in
> `README.md` (this folder), `docs/decisions/0013-draft-cv-export-architecture.md`,
> the US-039–US-042 story packets, and the updated `docs/product/*` docs. Where
> this brief and the harness artifacts disagree, the harness artifacts win
> (see the Restatements table in `README.md` for every deliberate deviation).

---

# Enhancement User Story: AI Draft CV Export for Job Application

## Feature Name

AI Draft CV Export — PDF/DOCX Resume Generator

## Background

ApplyWise already analyzes the user's current resume and job information. After
the resume-reading step and job-analysis step are completed, the system should
generate a recommended job-specific CV that the candidate can export and use to
apply for that role.

The generated CV must not be a generic rewrite. It must follow a strict
enhancement protocol that cross-references the current CV with the job
description, injects relevant keywords only when supported by the user's real
experience, rewrites bullets using the XYZ rule, preserves real metrics, and
outputs the result in a structured JSON format suitable for PDF/DOCX rendering.

## User Story

As a software engineer applying for a specific job, I want ApplyWise to
generate a tailored CV from my current resume and the analyzed job description
so that I can export a professional PDF or DOCX resume that is optimized for
that role while staying truthful to my actual experience.

## Goal

After the job analysis is complete, the user should be able to generate a
recommended CV draft, review it, and export it as PDF or DOCX using
ApplyWise's standard candidate resume format.

## Preconditions

- User has an active candidate profile.
- User has uploaded or pasted their current CV/resume.
- Resume text has been extracted and parsed.
- Job information has been imported, pasted, or discovered.
- Job description has been analyzed.
- Match analysis and missing skill analysis are available.

## Main Flow

1. User opens a job detail page.
2. User clicks Generate Draft CV.
3. System loads: current CV, parsed candidate profile, job description,
   extracted job keywords, match analysis, missing skill analysis.
4. AI executes the Cross-Referencing & Enhancement Protocol.
5. AI returns the recommended CV in strict structured JSON.
6. System renders the CV preview using ApplyWise's standard resume template.
7. User reviews the generated CV.
8. User can export the CV as PDF or DOCX.
9. Exported file is saved under the job record and can be downloaded again
   later.

## Cross-Referencing & Enhancement Protocol

### 1. Keyword Extraction

Identify mandatory hard skills, tools, frameworks, platforms, and methodologies
from the job description. Group keywords into categories: programming
languages, frameworks, backend, frontend, databases, cloud/DevOps, AI/ML/LLM
tools, testing/QA, methodologies, domain-specific requirements. Distinguish
required, preferred, nice-to-have, and repeated/high-priority keywords.

### 2. Alignment & Injection

Map extracted job keywords to the current CV. If the user's raw experience
clearly aligns with a job requirement, rewrite the related bullet to feature
that keyword more prominently. If a keyword is not supported by the user's
actual experience, do not inject it as a claimed skill. Group skills logically.
Prioritize JD-mentioned skills only when supported by the user's CV/profile.
Related experience can be reframed, but false claims must not be added.

Example: if the JD requires REST APIs and the current CV says "Worked on
backend services," the AI may rewrite it as "Developed REST API-backed backend
services to support production application workflows" — only if backend/API
work is supported by the CV.

### 3. XYZ Rule Enforcement

Rewrite every experience and project bullet as: Strong Action Verb + What was
done / Tech used + Impact or Result. Every bullet must start with a strong
action verb, describe what was done, mention relevant technology if supported,
and include impact/result when available. If no metric exists, focus on scope,
complexity, reliability, performance, collaboration, or business/user impact.
Do not invent metrics.

### 4. Metrics Preservation

Preserve all real numbers, percentages, dollar amounts, performance
improvements, user counts, latency improvements, and other metrics provided by
the user. Do not remove existing real metrics. Do not invent new metrics. Do
not estimate fake numbers. If no metrics exist, use qualitative impact instead
(e.g. improved maintainability, strengthened accessibility compliance, reduced
manual workflow complexity, supported production reliability, improved
developer handoff, enhanced user experience).

### 5. Truth Guard

Each improved bullet must include evidence metadata. Classify each generated
item as `safe_to_use` (clearly supported by current CV/profile),
`needs_confirmation` (plausible but not explicitly proven), or
`do_not_use_yet` (would create a new unsupported claim). The final exported CV
must include only `safe_to_use` and user-approved `needs_confirmation` items,
and must exclude `do_not_use_yet`.

## PDF/DOCX Export Formatting Rules

Text-only resume formatting: no markdown tables, charts, progress bars, or
ATS-breaking icons. Concise bullets, max 2 printed lines each. Clear section
headings, consistent spacing, ATS-friendly structure, ApplyWise standard
resume template. Output must be structured JSON renderable by Puppeteer,
HTML-to-PDF, or a DOCX generation engine.

## Required JSON Output Format

```json
{
  "candidate": { "full_name": "string", "email": "string | null", "phone": "string | null", "location": "string | null", "linkedin_url": "string | null", "github_url": "string | null", "portfolio_url": "string | null" },
  "target_job": { "company": "string | null", "title": "string | null", "source_url": "string | null" },
  "cv_strategy": { "summary": "string", "primary_positioning": "string", "keywords_prioritized": ["string"], "keywords_excluded": [ { "keyword": "string", "reason": "unsupported | weak_evidence | irrelevant" } ] },
  "professional_summary": "string",
  "skills": [ { "category": "Programming Languages", "items": ["string"] }, { "category": "Backend", "items": ["string"] }, { "category": "Frontend", "items": ["string"] }, { "category": "Databases", "items": ["string"] }, { "category": "Cloud & DevOps", "items": ["string"] }, { "category": "AI / ML", "items": ["string"] }, { "category": "Tools", "items": ["string"] } ],
  "work_experience": [ { "company": "string", "title": "string", "location": "string | null", "start_date": "string | null", "end_date": "string | null", "bullets": [ { "text": "string", "source_evidence": "string", "truth_guard_status": "safe_to_use | needs_confirmation | do_not_use_yet", "keywords_used": ["string"] } ] } ],
  "projects": [ { "name": "string", "description": "string | null", "tech_stack": ["string"], "bullets": [ { "text": "string", "source_evidence": "string", "truth_guard_status": "safe_to_use | needs_confirmation | do_not_use_yet", "keywords_used": ["string"] } ], "links": ["string"] } ],
  "education": [ { "school": "string", "degree": "string | null", "field": "string | null", "start_date": "string | null", "end_date": "string | null", "details": "string | null" } ],
  "certifications": [ { "name": "string", "issuer": "string | null", "date": "string | null", "credential_url": "string | null" } ],
  "export_notes": { "included_supported_keywords": ["string"], "excluded_unsupported_keywords": ["string"], "needs_user_review": ["string"], "metrics_preserved": ["string"] }
}
```

## UI Requirements

Add a new "Draft CV" section to the job detail page with: Generate Draft CV
button, CV strategy summary, keyword alignment summary, preview of generated
CV, Truth Guard warnings, Export PDF button, Export DOCX button, Regenerate
button, Save version button.

## Draft CV Page

Optional page `/jobs/:jobId/draft-cv` showing: target job information, CV
strategy, skills prioritized for this job, generated resume preview, warnings
for unsupported keywords, export actions.

## User Actions

Generate draft CV; review the CV; regenerate the CV; edit fields manually if
editing is supported; approve needs_confirmation suggestions; export as PDF;
export as DOCX; download previous generated versions.

## Acceptance Criteria

- **Generate Draft CV**: given a parsed resume and analyzed job, clicking
  Generate Draft CV generates a job-specific CV using the Cross-Referencing &
  Enhancement Protocol.
- **Keyword Extraction**: given a job description, generation extracts
  required and preferred keywords.
- **Keyword Alignment**: supported keywords are injected into relevant bullets
  and skills sections.
- **Unsupported Keywords**: unsupported keywords are excluded or marked as
  unsupported.
- **XYZ Bullet Rule**: every bullet follows the XYZ structure.
- **Metrics Preservation**: all real metrics are preserved.
- **No Hallucinated Metrics**: the AI must not invent numbers, percentages, or
  fake business impact.
- **JSON Output**: the response must be valid structured JSON matching the
  required schema.
- **PDF Export**: Export PDF renders the CV with the standard ApplyWise resume
  template and downloads a PDF.
- **DOCX Export**: Export DOCX generates a DOCX version of the same content.
- **Review Before Export**: if needs_confirmation items exist, the UI warns
  the user to review them before export.
- **Exclude Unsafe Claims**: `do_not_use_yet` bullets must not appear in the
  exported PDF or DOCX.
- **Save CV Version**: successful generation saves the CV version under the
  related job.

## Suggested API Endpoints

```http
POST /api/jobs/:jobId/draft-cv
GET  /api/jobs/:jobId/draft-cv
GET  /api/draft-cvs/:draftCvId
POST /api/draft-cvs/:draftCvId/export/pdf
POST /api/draft-cvs/:draftCvId/export/docx
POST /api/draft-cvs/:draftCvId/regenerate
```

## Suggested Database Update

```sql
create table draft_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  match_id uuid references matches(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  cv_json jsonb not null,
  cv_strategy_json jsonb,
  exported_pdf_url text,
  exported_docx_url text,
  model_provider text,
  model_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Allowed status values: `draft`, `needs_review`, `ready_to_export`, `exported`,
`failed`.

## Suggested Technologies

- PDF: Puppeteer / Playwright / HTML-to-PDF rendering.
- DOCX: `docx` npm package.
- Validation: Zod schema validation before rendering/export.
- Use the existing AI model integration for CV generation.

## AI Prompt Requirements

The AI must be instructed: you are generating a tailored CV for a software
engineer applying to a specific role; use the current CV and candidate profile
as the source of truth; use the job description to prioritize relevant
keywords; do not invent experience, projects, dates, companies,
certifications, metrics, or skills; preserve real metrics exactly; rewrite
every experience and project bullet using the XYZ rule; keep bullets concise
and ATS-friendly; return structured JSON only; exclude unsupported claims from
final export; mark uncertain claims as needs_confirmation.

## Completion Criteria

The enhancement is complete when: the user can generate a job-specific draft
CV after job analysis; AI performs keyword extraction and alignment before CV
generation; every bullet follows the XYZ rule; real metrics are preserved;
unsupported claims are excluded; CV output is valid JSON; the user can preview
the generated CV; the user can export PDF; the user can export DOCX; the
generated CV version is saved under the job; the user can regenerate the CV;
the exported CV follows ApplyWise's standard candidate resume format.
