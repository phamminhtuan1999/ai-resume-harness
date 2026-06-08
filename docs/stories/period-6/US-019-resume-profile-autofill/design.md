# Design

## User Story

As a software engineer, I want ApplyWise to automatically build my candidate
profile from my uploaded resume so that I do not have to manually fill out my
experience, skills, projects, and education.

## Acceptance Criteria

- Given I upload a resume PDF and the system has extracted text, when profile
  extraction runs, then the AI model generates a structured candidate profile.
- Given the structured profile is generated, then the profile form is auto-filled
  with extracted information.
- Given the auto-filled profile is shown, then I can review and edit all fields
  before saving.
- Given I save the profile, then the confirmed data becomes my active user
  profile.
- Given extraction fails, then I see an error and can retry or edit the profile
  manually.
- Given the AI is unsure about a field, then the field is left empty or marked
  as low confidence rather than guessed.

## Proposed APIs

```http
POST /api/resumes/:resumeId/extract-profile
```

Uses existing extracted resume text.

Response:

```json
{
  "resume_id": "uuid",
  "candidate_profile": {
    "basic_info": {},
    "professional_summary": {},
    "skills": {},
    "work_experience": [],
    "projects": [],
    "education": [],
    "certifications": [],
    "ai_metadata": {}
  },
  "confidence": {
    "overall": 0.86,
    "low_confidence_fields": []
  }
}
```

```http
POST /api/profile/import-from-resume
```

Request:

```json
{
  "resume_id": "uuid",
  "candidate_profile": {}
}
```

## Profile Data To Extract

Basic info:

- full name
- email
- phone
- location
- LinkedIn URL
- GitHub URL
- portfolio URL
- current title
- years of experience

Professional summary:

- resume summary
- AI-generated candidate summary
- primary engineering background
- seniority level

Skills:

- programming languages
- backend
- frontend
- databases
- cloud / DevOps
- AI / ML
- testing
- accessibility
- tools

Collections:

- work experience
- projects
- education
- certifications

AI-derived metadata:

- primary role family
- seniority level
- strongest skills
- weak AI-role areas
- suggested target roles

## AI Behavior Rules

- Use extracted resume text as source of truth.
- Do not invent companies, dates, skills, projects, metrics, or education.
- Missing data returns `null` or empty arrays.
- Preserve original resume bullet meaning.
- Normalize skills into categories.
- Separate work experience from projects when possible.
- Mark uncertain fields with low confidence.
- Return structured JSON only.
