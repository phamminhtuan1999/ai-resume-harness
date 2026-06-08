# ApplyWise AI Workflows

## Reliability Rules

- Save canonical resume content and raw job description input before AI
  processing.
- For file-based resumes, convert the uploaded file to canonical Markdown/text
  before downstream parsing.
- Validate every AI response with a schema.
- Retry once when structured JSON output is invalid.
- Show a clear error and retry action when generation fails.
- Do not delete canonical resume content or raw job input when parsing or
  generation fails.
- Do not invent resume facts, skills, projects, titles, certifications, or
  experience.

## Privacy Rules

- Resume files, resume text, and job description text are sensitive.
- Production logs must not include uploaded resume files, canonical resume
  content, or raw job description content.
- AI prompts should include only the minimum user data needed for the requested
  workflow.

## Resume Import Normalization

Input:

- pasted Markdown or plain text
- uploaded PDF
- uploaded DOCX
- uploaded image file

Tooling:

- Use Docling in the Python backend to normalize supported resume inputs.
- Export normalized resume content as Markdown/text for storage in `raw_text`.
- Store Docling JSON output when useful for debugging parser quality, but do
  not expose raw implementation details to the user interface by default.

Rules:

- Text and Markdown inputs do not require Docling unless the backend chooses to
  normalize formatting.
- PDF, DOCX, and image imports should be processed by Docling before the resume
  parser runs.
- OCR should be enabled for scanned PDFs and image resumes.
- Unsupported file types must be rejected before processing.
- Import failures must show a clear error and must not create a misleading
  parsed resume.
- Original uploaded file retention is optional. If retained, files must be
  stored privately and remain deletable by the user.

## Resume Parser

Input:

- canonical `raw_resume_text` from pasted text/Markdown or Docling import

Output:

- `name` when available
- `current_title` when available
- `skills`
- `experience`
- `projects`
- `education`
- `certifications`

Rule:

- Extract only what is present in the canonical resume content. Do not infer
  missing skills.

## Job Description Parser

Input:

- `raw_job_description`

Output:

- `required_skills`
- `preferred_skills`
- `responsibilities`
- `seniority`
- `years_required`
- `ai_requirements`
- `cloud_requirements`
- `domain`
- `work_type`

## Job URL Fetcher And Extractor

Input:

- user-submitted job URL

Provider order:

1. Firecrawl scrape URL.
2. Manual paste fallback when fetch fails.
3. Browserbase only for future agentic browsing workflows.
4. Apify actors, job APIs, and approved feeds only for future discovery.

Output:

- source URL
- company
- title
- location
- work type
- employment type
- salary range when present
- responsibilities
- required skills
- preferred skills
- required experience years
- AI-related requirements
- cloud requirements
- raw job description
- confidence score

Rules:

- Validate the submitted URL before fetching.
- Normalize URLs before duplicate checks.
- Do not create a duplicate job when the normalized URL already exists for the
  same user.
- Validate every provider and AI extraction response with a strict schema.
- Save fetched jobs with source `manual_url`.
- If fetch fails, show a fallback path for manual job description paste.
- Do not rely on unauthorized LinkedIn scraping as the primary product path.
  LinkedIn URLs are supported only when user-submitted pages are accessible to
  the approved fetch provider.

## Candidate Profile Extractor

Input:

- canonical resume text already extracted by resume import normalization

Output:

- basic info
- professional summary
- categorized skills
- work experience
- projects
- education
- certifications
- AI-derived metadata
- confidence details and low-confidence fields

Rules:

- Use canonical resume text as the source of truth.
- Return structured JSON only.
- Do not invent companies, dates, skills, projects, metrics, education, or
  certifications.
- Missing values must be `null` or empty arrays.
- Preserve original resume bullet meaning.
- Separate work experience from projects when possible.
- Mark uncertain fields with low confidence instead of guessing.
- The user must review and edit the profile draft before it becomes the active
  candidate profile.

## Match Analyzer

Input:

- structured resume
- structured job

Output:

- `overall_score`
- `skill_score`
- `experience_score`
- `ai_readiness_score`
- `ats_keyword_score`
- `seniority_score`
- strengths
- weaknesses
- missing skills
- risks
- explanations

Score formula:

```text
overall_score =
  skill_score * 0.30 +
  experience_score * 0.20 +
  ai_readiness_score * 0.25 +
  ats_keyword_score * 0.15 +
  seniority_score * 0.10
```

Score categories:

| Score | Meaning |
| --- | --- |
| 90-100 | Strong match |
| 75-89 | Good match |
| 60-74 | Possible match with gaps |
| 40-59 | Weak match |
| 0-39 | Not recommended yet |

## Missing Skill Analysis

Missing skills are grouped as:

- Critical
- Medium
- Nice-to-have

Each gap includes:

- skill name
- why it matters
- whether it is missing completely or weakly shown
- suggested action

Gap types:

- True Gap: the resume has no evidence of the skill.
- Wording Gap: related experience may exist, but the resume does not
  communicate it clearly.
- Proof Gap: the resume claims the skill but lacks strong project or work
  evidence.

## Resume Suggestion Generator

Each suggestion includes:

- original text
- suggested text
- reason
- related job requirement
- evidence
- Truth Guard status

Truth Guard statuses:

- `Safe to use`: supported clearly by resume evidence.
- `Needs confirmation`: may be true but requires user confirmation.
- `Do not use yet`: adds experience not found in the resume.

Suggestions marked `Do not use yet` must not be automatically included in a
generated Markdown draft.

## Roadmap Generator

Input:

- missing skills
- target role
- current resume

Output:

- exactly 4 weeks

Each week includes:

- goal
- skills covered
- tasks
- deliverables
- suggested project work
- resume bullet after completion

Critical missing skills should be prioritized first.

## Interview Prep Generator

Input:

- resume
- job
- missing skills
- match analysis

Output:

- likely technical questions
- likely AI/LLM questions
- likely system design questions
- likely behavioral questions
- weak topics to study
- suggested answer framing based on resume evidence

When the user lacks evidence for a topic, the prep should say the user needs to
study or build proof instead of pretending they already have experience.
