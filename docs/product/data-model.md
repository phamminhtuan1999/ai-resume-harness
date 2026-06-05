# ApplyWise Data Model

## Ownership Rule

Every user-owned record belongs to an app-level `user_profiles` row that maps
to Clerk's `clerk_user_id`. API handlers must enforce ownership on reads,
writes, updates, deletes, and generated analysis access.

## Tables

### `user_profiles`

Stores app-level profile data for a Clerk user.

Required fields:

- `id uuid primary key`
- `clerk_user_id text not null unique`
- `email text not null`
- `full_name text`
- `current_role text`
- `years_of_experience numeric`
- `target_role text`
- `location_preference text`
- `technical_background text`
- timestamps

### `resumes`

Stores canonical resume content and optional structured parser output.

Resume content can come from pasted Markdown/plain text or an imported PDF,
DOCX, or image file. Imported files are normalized through Docling into
canonical Markdown/text before downstream resume parsing.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `title text not null`
- `raw_text text not null`
- `source_type text not null default 'text'`
- `source_file_name text`
- `source_mime_type text`
- `source_size_bytes integer`
- `source_storage_path text`
- `docling_json jsonb`
- `import_status text default 'not_required'`
- `import_error text`
- `structured_json jsonb`
- `is_primary boolean default false`
- `parse_status text default 'not_parsed'`
- timestamps

Valid `source_type` values:

- `text`
- `markdown`
- `pdf`
- `docx`
- `image`

Valid `import_status` values:

- `not_required`
- `pending`
- `processing`
- `succeeded`
- `failed`

`raw_text` remains the canonical resume content used by the AI parser. For file
imports, `raw_text` stores Docling's Markdown/text output, not binary file
content.

### `jobs`

Stores manually entered job metadata, raw job description text, parser output,
and optional contact details.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `company text not null`
- `title text not null`
- `job_url text`
- `location text`
- `work_type text`
- `raw_description text not null`
- `structured_json jsonb`
- `parse_status text default 'not_parsed'`
- `contact_name text`
- `contact_email text`
- `contact_linkedin_url text`
- `contact_notes text`
- timestamps

### `matches`

Stores resume-to-job scoring and analysis output.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `resume_id uuid references resumes(id) on delete cascade`
- `job_id uuid references jobs(id) on delete cascade`
- `overall_score int`
- `skill_score int`
- `experience_score int`
- `ai_readiness_score int`
- `ats_keyword_score int`
- `seniority_score int`
- `strengths_json jsonb`
- `weaknesses_json jsonb`
- `missing_skills_json jsonb`
- `risks_json jsonb`
- `explanation_json jsonb`
- timestamps

### `resume_suggestions`

Stores generated resume suggestions and Truth Guard state.

Required fields:

- `id uuid primary key`
- `match_id uuid references matches(id) on delete cascade`
- `original_text text`
- `suggested_text text not null`
- `suggestion_type text`
- `related_job_requirement text`
- `evidence text`
- `truth_guard_status text not null`
- `reason text`
- `user_action text default 'pending'`
- timestamps

Valid `truth_guard_status` values:

- `Safe to use`
- `Needs confirmation`
- `Do not use yet`

### `resume_versions`

Stores generated Markdown resume drafts.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `resume_id uuid references resumes(id) on delete cascade`
- `job_id uuid references jobs(id) on delete cascade`
- `match_id uuid references matches(id) on delete cascade`
- `title text not null`
- `content_markdown text not null`
- timestamps

### `roadmaps`

Stores the generated 4-week improvement roadmap for a match.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid references matches(id) on delete cascade`
- `title text not null`
- `roadmap_json jsonb not null`
- timestamps

### `interview_preps`

Stores generated interview preparation output for a match.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `match_id uuid references matches(id) on delete cascade`
- `questions_json jsonb`
- `weak_topics_json jsonb`
- `study_plan_json jsonb`
- `answer_guidance_json jsonb`
- timestamps

### `applications`

Stores tracker state for saved jobs and applications.

Required fields:

- `id uuid primary key`
- `user_id uuid references user_profiles(id) on delete cascade`
- `job_id uuid references jobs(id) on delete cascade`
- `match_id uuid references matches(id) on delete set null`
- `status text not null default 'saved'`
- `applied_date date`
- `notes text`
- timestamps

Valid `status` values:

- `Saved`
- `Applied`
- `Interviewing`
- `Offer`
- `Rejected`
- `Archived`
