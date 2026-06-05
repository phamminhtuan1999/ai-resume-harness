ApplyWise — Product SPEC

1. Product Summary

ApplyWise is an AI-powered career copilot for software engineers in the US market who want to apply for AI Engineer / Applied AI Engineer / LLM Engineer / GenAI Engineer roles.

The application helps users:

1. Upload or paste their resume content.
2. Paste a job description manually.
3. Analyze resume-to-job fit.
4. Identify missing skills and weak positioning.
5. Generate safe, evidence-based resume improvements.
6. Suggest a 4-week skill/project improvement plan.
7. Generate interview preparation suggestions.
8. Track applications and recruiter/contact information.
9. Prepare for future SaaS monetization without enabling payment in MVP.

The core differentiator is:

ApplyWise does not simply rewrite resumes. It explains what is missing, what can be improved honestly, and what the candidate should build or learn before applying.

⸻

2. Product Positioning

Product Name

ApplyWise

Target Market

US job market.

Target User

Software engineers who want to transition into AI-focused roles.

Not Targeted in MVP

ApplyWise is not for:

- Non-technical roles
- General resume users
- Immigrant-specific career guidance
- Auto job application automation
- LinkedIn scraping
- Recruiter-side hiring tools

Language

English only.

⸻

3. Core User Persona

Persona: Software Engineer Transitioning to AI Engineer

Example profile:

Current Role: Software Engineer
Experience: 2–6 years
Background: Backend, full-stack, frontend, QA automation, cloud, or enterprise software
Goal: Apply to AI Engineer / LLM Engineer / Applied AI Engineer roles
Pain:

- Resume does not clearly show AI experience
- Does not know which AI skills are missing
- Does not know whether a job is realistic to apply for
- Does not know what project to build next
- Needs US-style resume wording

⸻

4. Product Goals

MVP Goals

ApplyWise MVP should allow a user to:

1. Sign in.
2. Create a profile.
3. Add resume content.
4. Paste a job description.
5. Generate a match analysis.
6. See missing skills.
7. Receive safe resume improvement suggestions.
8. Receive a 4-week improvement roadmap.
9. Receive interview preparation suggestions.
10. Save the job and contact info into an application tracker.
11. View a payment/pricing screen placeholder.

Post-MVP Goals

1. Resume PDF/DOCX export.
2. Resume editor.
3. Job URL parser.
4. Full payment integration.
5. Advanced AI model switching.
6. Resume version history.
7. GitHub project analysis.
8. Chrome extension.
9. More advanced interview practice.

⸻

5. Key Product Decisions

Area Decision
App name ApplyWise
Market US
Target user Software engineers moving toward AI roles
Language English only
JD input Manual paste only for MVP
Resume output Markdown/Text only for MVP
Resume editor Post-MVP
Export PDF/DOCX Important post-MVP feature
Skill roadmap 4 weeks
Interview prep Suggestions and missing-skill improvement focus
Application tracker Yes
Follow-up email generator No MVP
Recruiter/contact saving Yes
Auth Clerk
Frontend Next.js + shadcn/ui
Backend Python preferred
Go Consider for future services, not MVP core
Database Supabase Postgres
AI model Gemini/free model first
Payment No real payment in MVP, but include pricing/payment screen
SaaS seriousness Serious SaaS architecture from beginning

⸻

6. Recommended Tech Stack

Frontend

Next.js
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod

Auth

Clerk

Database

Supabase Postgres
Supabase Storage later for file uploads

Backend / AI Service

Recommended MVP:

Python + FastAPI

Reason:

- Better AI ecosystem.
- Easier integration with LLM SDKs.
- Good for AI Engineer portfolio.
- Easier parsing, embeddings, structured outputs.

AI Model

MVP first option:

Gemini API / free-tier-friendly model

Fallback/future:

OpenAI
Claude
Open-source local model

Deployment

Frontend: Vercel
Backend: Render / Fly.io / Railway
Database: Supabase
Auth: Clerk

Why not Go for MVP?

Go is strong for performance, infrastructure, and backend services, but for this MVP the AI workflow benefits more from Python. Go can be added later for:

- High-performance scoring service
- Job ingestion worker
- Queue processor
- Billing/event service

MVP should not split into too many services.

⸻

7. AI Skill Trend Alignment

ApplyWise should evaluate candidates against skills commonly seen in AI Engineer job descriptions:

Python
FastAPI
LLM APIs
RAG
Vector databases
Embeddings
LangChain / LangGraph
Prompt engineering
Tool calling
Agents
Evaluation
Docker
Cloud deployment
AWS / GCP / Azure
SQL / Postgres
Backend API design
System design

For US software engineers, the product should emphasize not only AI buzzwords but also production engineering:

API design
Observability
Testing
Security
Data privacy
Deployment
Scalability
Product judgment

This matters because current market discussions increasingly separate engineers who only code from engineers who can design, evaluate, ship, and communicate AI-powered products ￼.

⸻

8. MVP Feature List

Feature 1: Authentication

Users can sign up, log in, and access their private workspace.

Feature 2: User Profile

Users can define:

Name
Current role
Years of experience
Target role
Location preference
Work authorization optional
Main technical background

Feature 3: Resume Input

MVP supports:

Paste resume text
Upload resume file optional if simple

For MVP, Markdown/Text is enough.

Post-MVP:

PDF upload
DOCX upload
Resume editor
Export PDF/DOCX

Feature 4: Manual Job Description Input

Users paste a job description manually.

Fields:

Job title
Company
Job location
Job URL optional
Job description text
Recruiter/contact name optional
Recruiter/contact email optional
Contact notes optional

Feature 5: Job Parsing

AI extracts:

Required skills
Preferred skills
Responsibilities
Seniority level
Years of experience
AI/LLM requirements
Cloud/deployment requirements
Domain
Work type

Feature 6: Match Analysis

AI generates:

Overall match score
Skill score
Experience score
AI readiness score
ATS keyword score
Seniority score
Strengths
Weaknesses
Risks

Feature 7: Missing Skill Analysis

AI identifies missing or weak skills:

Critical missing skills
Medium missing skills
Nice-to-have skills
Resume wording gaps
Actual experience gaps

Feature 8: Resume Improvement Suggestions

AI suggests improvements but must use Truth Guard.

Each suggestion includes:

Original text
Suggested improvement
Reason
Evidence source
Truth Guard status

Truth Guard statuses:

Safe to use
Needs confirmation
Do not use yet

Feature 9: 4-Week Improvement Roadmap

AI generates a 4-week roadmap based on missing skills.

Each week includes:

Goal
Skills covered
Tasks
Deliverables
Suggested project work
Resume bullet after completion

Feature 10: Interview Prep Suggestions

Focus:

What the user is likely to be asked
What topics are missing
What to study
How to frame current experience
Suggested answer structure

No voice mock interview in MVP.

No full chat simulation in MVP.

Feature 11: Application Tracker

Users can save jobs and track status.

Statuses:

Saved
Applied
Interviewing
Offer
Rejected
Archived

Tracker should store contact info.

Feature 12: Pricing / Payment Screen Placeholder

MVP includes a pricing page but does not process payment yet.

Example plans:

Free
Pro

The buttons can say:

Coming soon

⸻

9. Product Modules

Module 1: Auth & Account

Handles user authentication and session.

Module 2: Resume Workspace

Stores and displays resume text/Markdown.

Module 3: Job Workspace

Stores pasted job descriptions and job metadata.

Module 4: AI Analysis Engine

Runs parsing, scoring, gap analysis, resume suggestions, roadmap, and interview prep.

Module 5: Application Tracker

Stores application status and contacts.

Module 6: Billing Placeholder

Displays pricing and future SaaS packaging.

⸻

10. User Stories & Acceptance Criteria by Period

Below is the build plan split into 4 MVP periods. Each period can be treated like a sprint/week.

⸻

Period 1 — Foundation, Auth, Profile, Resume, JD Input

Goal

Build the base SaaS shell and let users create their first resume and job record.

⸻

User Story 1.1 — User Sign Up / Login

As a user, I want to sign up and log in so that my resume and job data are private.

Acceptance Criteria

Given I am a new user
When I open ApplyWise
Then I can sign up using Clerk
Given I am an existing user
When I log in
Then I am redirected to my dashboard
Given I am not logged in
When I try to access protected pages
Then I am redirected to the login page
Given I am logged in
When I click logout
Then my session is ended

Notes

Use Clerk hosted components first to save time.

⸻

User Story 1.2 — Dashboard Shell

As a user, I want to see a dashboard so that I know where to start.

Acceptance Criteria

Given I am logged in
When I visit /dashboard
Then I see a welcome message
And I see quick actions:

- Add Resume
- Analyze Job
- View Tracker
  Given I have no resume
  When I open dashboard
  Then I see an empty state telling me to add my resume first
  Given I have at least one resume
  When I open dashboard
  Then I see my primary resume summary

⸻

User Story 1.3 — Create User Career Profile

As a user, I want to enter my career goal so that analysis is tailored to AI Engineer roles.

Acceptance Criteria

Given I am on profile setup
When I enter my current role, years of experience, and target role
Then the system saves my profile
Given I choose a target role
When options are displayed
Then I can select:

- AI Engineer
- Applied AI Engineer
- LLM Engineer
- GenAI Engineer
- ML Engineer
  Given my profile is saved
  When I return to dashboard
  Then I can see my target role

Profile Fields

current_role
years_of_experience
target_role
location_preference
technical_background

⸻

User Story 1.4 — Add Resume Text

As a user, I want to paste my resume in Markdown/Text so that ApplyWise can analyze it.

Acceptance Criteria

Given I am on /resumes/new
When I paste resume text and click Save
Then the resume is stored in my account
Given the resume text is empty
When I click Save
Then I see a validation error
Given my resume is saved
When I go to /resumes
Then I see the resume in the list
Given I open a saved resume
When I visit /resumes/:id
Then I can view the resume content

MVP Constraint

No full resume editor yet. User can replace the resume text, but not edit section-by-section.

⸻

User Story 1.5 — Add Job Description Manually

As a user, I want to paste a job description manually so that I can analyze fit.

Acceptance Criteria

Given I am on /jobs/new
When I enter company, job title, job URL optional, and JD text
Then I can save the job
Given the JD text is empty
When I click Save
Then I see a validation error
Given a job is saved
When I open /jobs
Then I see the saved job in the list
Given I open /jobs/:id
Then I can view the job metadata and raw JD

⸻

User Story 1.6 — Save Contact Information

As a user, I want to save recruiter or contact information for a job so that I can track who I talked to.

Acceptance Criteria

Given I am creating a job
When I enter contact name, email, LinkedIn URL, and notes
Then the contact info is saved with the job
Given a job has contact info
When I open the job detail page
Then I can see contact name, email, LinkedIn URL, and notes
Given contact info is optional
When I save a job without contact info
Then the job still saves successfully

⸻

Period 1 Completion Criteria

Period 1 is complete when:

- User can sign up/login
- User can create profile
- User can add resume text
- User can add job description manually
- User can save contact info
- Dashboard shows basic empty/full states

⸻

Period 2 — AI Parsing, Match Score, Missing Skills

Goal

Turn raw resume and JD into structured AI analysis.

⸻

User Story 2.1 — Parse Resume Into Structured Profile

As a user, I want ApplyWise to extract my skills and experience from my resume so that analysis can be more accurate.

Acceptance Criteria

Given I have saved a resume
When I click Parse Resume
Then the system extracts structured data
The structured data includes:

- name if available
- current title if available
- skills
- work experience
- projects
- education
- certifications
  Given parsing succeeds
  Then I see a structured resume summary
  Given parsing fails
  Then I see a helpful error message
  And the raw resume text is not deleted

AI Rule

Do not invent skills. Extract only what appears in the resume.

⸻

User Story 2.2 — Parse Job Description

As a user, I want ApplyWise to extract job requirements from the pasted JD so that I can understand what the job actually wants.

Acceptance Criteria

Given I have saved a job description
When I click Parse Job
Then the system extracts job requirements
The extracted data includes:

- required skills
- preferred skills
- responsibilities
- seniority
- years of experience
- AI/LLM requirements
- cloud/deployment requirements
- domain
- work type if available
  Given parsing succeeds
  Then I see the extracted job requirements
  Given parsing fails
  Then I see a helpful error
  And the raw JD remains saved

⸻

User Story 2.3 — Generate Match Score

As a user, I want to see how well my resume matches a job so that I know whether it is worth applying.

Acceptance Criteria

Given I have one parsed resume
And I have one parsed job
When I click Generate Match
Then the system returns a match analysis
The analysis includes:

- overall score
- skill score
- experience score
- AI readiness score
- ATS keyword score
- seniority score
  Given scores are displayed
  Then each score includes a short explanation
  Given the job requires critical skills missing from the resume
  Then the score reflects that gap
  And the explanation clearly says what is missing

Score Categories

90–100: Strong match
75–89: Good match
60–74: Possible match with gaps
40–59: Weak match
0–39: Not recommended

⸻

User Story 2.4 — Show Strengths

As a user, I want to see where I already match the job so that I can position myself better.

Acceptance Criteria

Given a match analysis exists
When I open the match page
Then I see a Strengths section
Each strength includes:

- matched skill or experience
- evidence from resume
- related job requirement

Example:

Strength:
Backend API experience
Evidence:
Resume mentions REST API and SQL-backed application work.
Related JD requirement:
Build production AI services and APIs.

⸻

User Story 2.5 — Show Missing Skills

As a user, I want to see what is missing so that I know what to improve before applying.

Acceptance Criteria

Given a match analysis exists
When I open the Missing Skills section
Then I see gaps grouped by:

- Critical
- Medium
- Nice-to-have
  Each gap includes:
- skill name
- why it matters
- whether it is missing completely or just weakly shown
- suggested action

Gap Types

True Gap:
The resume has no evidence of the skill.
Wording Gap:
The user may have related experience, but the resume does not communicate it clearly.
Proof Gap:
The user claims the skill but has no strong project/work evidence.

⸻

User Story 2.6 — AI Readiness Score

As a user, I want a specific AI readiness score so that I know whether my resume looks ready for AI Engineer roles.

Acceptance Criteria

Given a match analysis exists
Then the system displays an AI Readiness Score
The score considers:

- Python
- LLM APIs
- RAG
- embeddings
- vector database
- agents/tool calling
- AI evaluation
- deployment
- backend API experience
  Given the user has backend experience but little AI experience
  Then the AI readiness score should be lower than the general experience score

⸻

Period 2 Completion Criteria

Period 2 is complete when:

- Resume parser works
- JD parser works
- Match score works
- Strengths are shown with evidence
- Missing skills are categorized
- AI readiness score is shown

⸻

Period 3 — Resume Suggestions, Truth Guard, Roadmap, Interview Prep

Goal

Turn analysis into actionable improvements.

⸻

User Story 3.1 — Generate Resume Improvement Suggestions

As a user, I want ApplyWise to suggest better resume wording so that I can improve my resume for a specific job.

Acceptance Criteria

Given I have a match analysis
When I click Generate Resume Suggestions
Then the system suggests improvements
Each suggestion includes:

- original text
- suggested text
- reason
- related JD requirement
- evidence
- Truth Guard status

⸻

User Story 3.2 — Truth Guard

As a user, I want the system to warn me when a resume suggestion is not supported by my actual experience so that I do not accidentally lie.

Acceptance Criteria

Given a suggested bullet is based clearly on resume evidence
Then the status is Safe to use
Given a suggested bullet may be true but needs user confirmation
Then the status is Needs confirmation
Given a suggested bullet adds experience not found in the resume
Then the status is Do not use yet
Given a suggestion is marked Do not use yet
Then the UI visually warns the user
And explains what evidence is missing

Truth Guard Statuses

Safe to use
Needs confirmation
Do not use yet

⸻

User Story 3.3 — Markdown Tailored Resume Draft

As a user, I want to generate a Markdown resume draft so that I can copy it into another tool.

Acceptance Criteria

Given I have resume suggestions
When I click Generate Markdown Draft
Then the system creates a Markdown resume version
Given a suggestion is marked Do not use yet
Then it is not automatically included in the draft
Given a suggestion is marked Needs confirmation
Then the user must manually choose whether to include it
Given the draft is generated
Then the user can copy the Markdown text

MVP Constraint

No PDF/DOCX export yet.

Post-MVP Note

PDF/DOCX export is a high-priority post-MVP update.

⸻

User Story 3.4 — Generate 4-Week Improvement Roadmap

As a user, I want a 4-week plan based on missing skills so that I know exactly what to build or learn.

Acceptance Criteria

Given I have missing skills
When I click Generate Roadmap
Then the system creates a 4-week roadmap
Each week includes:

- weekly goal
- skills covered
- tasks
- deliverables
- project suggestion
- resume bullet after completion
  Given the job requires AI skills missing from the resume
  Then the roadmap prioritizes critical missing skills first

Roadmap Example Structure

Week 1:
Python + FastAPI foundation
Week 2:
LLM API integration + structured output
Week 3:
RAG + embeddings + Supabase pgvector
Week 4:
Evaluation, deployment, README, resume bullet

⸻

User Story 3.5 — Suggest Missing-Skill Improvements

As a user, I want ApplyWise to tell me how to fix missing skills so that I can become a stronger candidate.

Acceptance Criteria

Given a missing skill exists
Then the system suggests one or more improvement actions
Improvement actions can include:

- Learn this concept
- Build this feature
- Add this project
- Rewrite this existing experience
- Prepare for this interview topic
  Given the missing skill is critical
  Then the improvement suggestion must be practical and specific

Example:

Missing skill:
Vector database
Improvement:
Add a feature that stores resume and JD embeddings in Supabase pgvector and uses semantic search to compare skill similarity.

⸻

User Story 3.6 — Generate Interview Prep Suggestions

As a user, I want interview prep suggestions based on the job and my gaps so that I know what to prepare.

Acceptance Criteria

Given I have a match analysis
When I click Generate Interview Prep
Then the system creates interview prep content
The content includes:

- likely technical questions
- likely AI/LLM questions
- likely system design questions
- likely behavioral questions
- weak topics to study
- suggested answer framing based on resume evidence
  Given the user lacks evidence for a topic
  Then the prep should say the user needs to study/build proof
  Instead of pretending the user has experience

⸻

User Story 3.7 — Save Analysis Result

As a user, I want to save match analysis, roadmap, and interview prep so that I can return later.

Acceptance Criteria

Given a match analysis is generated
Then it is saved automatically
Given a roadmap is generated
Then it is saved under the match
Given interview prep is generated
Then it is saved under the match
Given I return to the job page later
Then I can reopen the saved analysis

⸻

Period 3 Completion Criteria

Period 3 is complete when:

- Resume suggestions work
- Truth Guard works
- Markdown tailored resume draft works
- 4-week roadmap works
- Missing-skill improvements work
- Interview prep suggestions work
- Results are saved

⸻

Period 4 — Tracker, SaaS Packaging, Pricing Screen, Polish

Goal

Make ApplyWise feel like a real SaaS MVP, not just a demo.

⸻

User Story 4.1 — Application Tracker

As a user, I want to track my applications so that I can manage my job search.

Acceptance Criteria

Given I have a saved job
When I click Add to Tracker
Then the job appears in the tracker
The tracker has statuses:

- Saved
- Applied
- Interviewing
- Offer
- Rejected
- Archived
  Given a job is in the tracker
  When I update the status
  Then the new status is saved
  Given I return to the tracker later
  Then the saved statuses remain

⸻

User Story 4.2 — Tracker Contact Info

As a user, I want to see contact information in the tracker so that I know who is connected to each job.

Acceptance Criteria

Given a job has contact info
When I open tracker
Then I can see contact name or contact badge
Given I open a tracker item
Then I can see:

- contact name
- contact email
- LinkedIn URL
- notes
  Given a job has no contact info
  Then the UI shows an empty contact state

⸻

User Story 4.3 — Pricing Page Placeholder

As a SaaS founder, I want a pricing page so that the product can be monetized later.

Acceptance Criteria

Given a user visits /pricing
Then they see pricing plans
The MVP plans are:

- Free
- Pro
  Given the user clicks Upgrade
  Then the button shows Coming soon
  And no payment is processed

Suggested Pricing Copy

Free:
Analyze a limited number of jobs and generate basic match reports.
Pro:
Unlimited analysis, advanced resume versions, export, roadmap, and interview prep.

⸻

User Story 4.4 — Settings Page

As a user, I want to manage account settings so that I can control my data.

Acceptance Criteria

Given I am logged in
When I open /settings
Then I can see my account email and profile information
Given I want to delete a resume
When I confirm deletion
Then the resume is removed from my account
Given I want to delete a job
When I confirm deletion
Then the job and related analysis are removed

⸻

User Story 4.5 — Empty States and Error States

As a user, I want clear UI messages so that I know what to do next.

Acceptance Criteria

Given I have no resumes
Then the resume page shows an empty state with Add Resume button
Given I have no jobs
Then the jobs page shows an empty state with Add Job button
Given AI generation fails
Then the UI shows an error message
And allows retry
Given AI generation is running
Then the UI shows loading state
And prevents duplicate submissions

⸻

User Story 4.6 — Landing Page

As a visitor, I want to understand what ApplyWise does before signing up.

Acceptance Criteria

Given I visit the homepage
Then I see:

- clear headline
- target user
- core benefits
- CTA to sign up
- product screenshots or mock cards
- pricing link
  The landing page must clearly say:
  ApplyWise is for software engineers applying to AI roles.

Suggested Headline

Apply to AI Engineer roles with a smarter resume strategy.

Suggested Subheadline

ApplyWise analyzes your software engineering resume against AI job descriptions, finds missing skills, suggests honest resume improvements, and gives you a 4-week plan to become a stronger candidate.

⸻

User Story 4.7 — MVP Demo Flow

As a founder/developer, I want a clean demo flow so that I can show the app to recruiters or early users.

Acceptance Criteria

Given a fresh account
When I complete the demo flow
Then I can:

1. Add resume
2. Add JD
3. Generate match score
4. View missing skills
5. Generate resume suggestions
6. Generate roadmap
7. Generate interview prep
8. Save job to tracker
   The full demo should take less than 5 minutes.

⸻

Period 4 Completion Criteria

Period 4 is complete when:

- Tracker works
- Contact saving works
- Pricing page exists
- Landing page exists
- Settings page exists
- Empty/error/loading states exist
- Full demo flow works smoothly

⸻

11. Page Specification

Public Pages

/
/pricing
/sign-in
/sign-up

Protected Pages

/dashboard
/profile
/resumes
/resumes/new
/resumes/:id
/jobs
/jobs/new
/jobs/:id
/matches/:id
/matches/:id/resume-suggestions
/matches/:id/roadmap
/matches/:id/interview-prep
/tracker
/settings

⸻

12. Main UI Navigation

Sidebar:

Dashboard
Resumes
Jobs
Tracker
Pricing
Settings

Primary CTA:

Analyze New Job

⸻

13. Data Model

users

Managed mainly by Clerk, but store app-level user profile.

create table user_profiles (
id uuid primary key default gen_random_uuid(),
clerk_user_id text not null unique,
email text not null,
full_name text,
current_role text,
years_of_experience numeric,
target_role text,
location_preference text,
technical_background text,
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

resumes

create table resumes (
id uuid primary key default gen_random_uuid(),
user_id uuid references user_profiles(id) on delete cascade,
title text not null,
raw_text text not null,
structured_json jsonb,
is_primary boolean default false,
parse_status text default 'not_parsed',
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

jobs

create table jobs (
id uuid primary key default gen_random_uuid(),
user_id uuid references user_profiles(id) on delete cascade,
company text not null,
title text not null,
job_url text,
location text,
work_type text,
raw_description text not null,
structured_json jsonb,
parse_status text default 'not_parsed',
contact_name text,
contact_email text,
contact_linkedin_url text,
contact_notes text,
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

matches

create table matches (
id uuid primary key default gen_random_uuid(),
user_id uuid references user_profiles(id) on delete cascade,
resume_id uuid references resumes(id) on delete cascade,
job_id uuid references jobs(id) on delete cascade,
overall_score int,
skill_score int,
experience_score int,
ai_readiness_score int,
ats_keyword_score int,
seniority_score int,
strengths_json jsonb,
weaknesses_json jsonb,
missing_skills_json jsonb,
risks_json jsonb,
explanation_json jsonb,
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

resume_suggestions

create table resume_suggestions (
id uuid primary key default gen_random_uuid(),
match_id uuid references matches(id) on delete cascade,
original_text text,
suggested_text text not null,
suggestion_type text,
related_job_requirement text,
evidence text,
truth_guard_status text not null,
reason text,
user_action text default 'pending',
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

resume_versions

create table resume_versions (
id uuid primary key default gen_random_uuid(),
user_id uuid references user_profiles(id) on delete cascade,
resume_id uuid references resumes(id) on delete cascade,
job_id uuid references jobs(id) on delete cascade,
match_id uuid references matches(id) on delete cascade,
title text not null,
content_markdown text not null,
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

roadmaps

create table roadmaps (
id uuid primary key default gen_random_uuid(),
user_id uuid references user_profiles(id) on delete cascade,
match_id uuid references matches(id) on delete cascade,
title text not null,
roadmap_json jsonb not null,
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

interview_preps

create table interview_preps (
id uuid primary key default gen_random_uuid(),
user_id uuid references user_profiles(id) on delete cascade,
match_id uuid references matches(id) on delete cascade,
questions_json jsonb,
weak_topics_json jsonb,
study_plan_json jsonb,
answer_guidance_json jsonb,
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

applications

create table applications (
id uuid primary key default gen_random_uuid(),
user_id uuid references user_profiles(id) on delete cascade,
job_id uuid references jobs(id) on delete cascade,
match_id uuid references matches(id) on delete set null,
status text not null default 'saved',
applied_date date,
notes text,
created_at timestamptz default now(),
updated_at timestamptz default now()
);

⸻

14. API Specification

Auth

Handled by Clerk.

Backend should verify Clerk token before protected API calls.

⸻

Profile APIs

GET /api/profile
PUT /api/profile

⸻

Resume APIs

POST /api/resumes
GET /api/resumes
GET /api/resumes/:resumeId
PUT /api/resumes/:resumeId
DELETE /api/resumes/:resumeId
POST /api/resumes/:resumeId/parse

⸻

Job APIs

POST /api/jobs
GET /api/jobs
GET /api/jobs/:jobId
PUT /api/jobs/:jobId
DELETE /api/jobs/:jobId
POST /api/jobs/:jobId/parse

⸻

Match APIs

POST /api/matches
GET /api/matches
GET /api/matches/:matchId
POST /api/matches/:matchId/regenerate

Request:

{
"resume_id": "uuid",
"job_id": "uuid"
}

⸻

Resume Suggestion APIs

POST /api/matches/:matchId/resume-suggestions
GET /api/matches/:matchId/resume-suggestions
PUT /api/resume-suggestions/:suggestionId
POST /api/matches/:matchId/resume-version

⸻

Roadmap APIs

POST /api/matches/:matchId/roadmap
GET /api/matches/:matchId/roadmap

⸻

Interview Prep APIs

POST /api/matches/:matchId/interview-prep
GET /api/matches/:matchId/interview-prep

⸻

Tracker APIs

POST /api/applications
GET /api/applications
PUT /api/applications/:applicationId
DELETE /api/applications/:applicationId

⸻

15. AI Workflow

AI Step 1: Resume Parser

Input:

raw_resume_text

Output:

{
"current_title": "string",
"skills": ["string"],
"experience": [],
"projects": [],
"education": [],
"certifications": []
}

Rule:

Extract only what is present. Do not infer missing skills.

⸻

AI Step 2: JD Parser

Input:

raw_job_description

Output:

{
"required_skills": [],
"preferred_skills": [],
"responsibilities": [],
"seniority": "string",
"ai_requirements": [],
"cloud_requirements": [],
"years_required": "string"
}

⸻

AI Step 3: Match Analyzer

Input:

structured_resume
structured_job

Output:

{
"scores": {},
"strengths": [],
"weaknesses": [],
"missing_skills": [],
"risks": []
}

⸻

AI Step 4: Resume Suggestion Generator

Input:

resume
job
match_analysis

Output:

{
"suggestions": [
{
"original_text": "string",
"suggested_text": "string",
"truth_guard_status": "Safe to use | Needs confirmation | Do not use yet",
"evidence": "string",
"reason": "string"
}
]
}

⸻

AI Step 5: Roadmap Generator

Input:

missing_skills
target_role
current_resume

Output:

{
"weeks": [
{
"week": 1,
"goal": "string",
"tasks": [],
"deliverables": [],
"skills_covered": [],
"resume_bullet_after_completion": "string"
}
]
}

Must always generate exactly 4 weeks.

⸻

AI Step 6: Interview Prep Generator

Input:

resume
job
missing_skills
match_analysis

Output:

{
"technical_questions": [],
"ai_llm_questions": [],
"system_design_questions": [],
"behavioral_questions": [],
"weak_topics_to_study": [],
"answer_guidance": []
}

⸻

16. Scoring Model v1

Score Formula

overall_score =
skill_score _ 0.30 +
experience_score _ 0.20 +
ai_readiness_score _ 0.25 +
ats_keyword_score _ 0.15 +
seniority_score \* 0.10

Score Meaning

90–100: Strong match
75–89: Good match
60–74: Possible match with gaps
40–59: Weak match
0–39: Not recommended yet

AI Readiness Score Should Consider

Python
LLM API experience
RAG
Embeddings
Vector database
Agents/tool calling
AI evaluation
FastAPI/API service
Deployment
Production engineering

⸻

17. Pricing Placeholder

/pricing

Plans:

Free

For exploring ApplyWise.
Includes:

- Limited resume analysis
- Limited job match analysis
- Basic roadmap

Pro

For serious AI role applications.
Includes:

- More job analyses
- Resume versions
- Advanced roadmap
- Interview prep
- Future PDF/DOCX export

Button:

Coming soon

No Stripe required in MVP.

⸻

18. Non-Functional Requirements

Privacy

Resume and job data are sensitive.

Requirements:

- User can only access their own data
- Protected API routes require auth
- Avoid logging raw resume/JD in production
- Allow user to delete resume/job data

AI Reliability

- Validate AI responses with schema
- Retry once if JSON output is invalid
- Save raw input before AI processing
- Show error and retry button if AI fails

UX

- Every AI action must show loading state
- Do not allow duplicate generation clicks
- Empty states must be clear
- Main demo flow should take under 5 minutes

MVP Performance Targets

Resume parse: under 20 seconds
JD parse: under 15 seconds
Match analysis: under 30 seconds
Resume suggestions: under 45 seconds
Roadmap: under 30 seconds
Interview prep: under 30 seconds

⸻

19. Post-MVP Roadmap

High Priority

PDF/DOCX resume export
Resume section-by-section editor
Resume version comparison
Job URL parser
Stripe payment integration

Medium Priority

Chrome extension
GitHub project analyzer
AI mock interview chat
Advanced model selector
Application analytics

Later

Voice interview
Auto job recommendations
Public portfolio generator
Recruiter outreach generator
Team/career coach dashboard

⸻

20. Final MVP Definition

ApplyWise MVP is complete when a user can:

1. Sign up/login
2. Create career profile
3. Add resume text
4. Add job description manually
5. Save contact info
6. Parse resume
7. Parse job
8. Generate match score
9. View strengths and missing skills
10. Generate safe resume suggestions
11. Generate Markdown resume draft
12. Generate 4-week roadmap
13. Generate interview prep suggestions
14. Save job to application tracker
15. View pricing screen

⸻

21. Suggested Build Order

Week 1

Auth
Dashboard
Profile
Resume CRUD
Job CRUD
Contact fields
Basic layout

Week 2

Gemini integration
Resume parser
JD parser
Match analysis
Missing skills page

Week 3

Resume suggestions
Truth Guard
Markdown resume draft
4-week roadmap
Interview prep

Week 4

Application tracker
Pricing page
Landing page
Settings
Polish
Demo data
Deploy

⸻

22. Recommended Repository Structure

applywise/
apps/
web/
app/
components/
lib/
hooks/
types/
services/
api/
app/
routers/
services/
ai/
schemas/
db/
docs/
SPEC.md
API.md
DATABASE.md
PROMPTS.md

For MVP, monorepo is okay. Keep frontend and backend separated enough so it looks professional.

⸻

23. Suggested README Pitch

ApplyWise is an AI-powered career copilot for software engineers applying to AI Engineer roles in the US market.
It analyzes a candidate’s resume against pasted job descriptions, identifies missing AI skills, generates evidence-based resume improvements using Truth Guard, and creates a 4-week improvement roadmap with interview preparation suggestions.

⸻

24. Add this Concept in the UI

“Apply Now or Improve First?”

After match analysis, show one decision card:

Recommendation:
Apply now
or
Improve first

Possible outputs:

Apply now:
You meet most required qualifications. Improve wording before applying.
Apply with caution:
You have strong backend experience but weak AI project evidence.
Improve first:
This role requires RAG, vector databases, and production LLM experience not shown in your resume.
