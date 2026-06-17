# ApplyWise Enhancement — Add Job / Find or Import Job Intake Flow

**Document Type:** Product Enhancement Requirement / User Stories  
**Audience:** AI coding agent, product engineer, frontend/backend developer  
**Authoring Role:** Lead Business Analyst / Enterprise Product Architect  
**Product:** ApplyWise  
**Feature Area:** Job Intake, AI Job Discovery, AI Role Relevance Filtering, Job Analysis Entry Flow  
**Status:** Enhancement for existing MVP  

---

## 1. Executive Summary

The current product has an **Import Job** concept, but the product vision has evolved. ApplyWise should not only accept a job URL or pasted job description. It should help software engineers who want to transition into AI Engineer / Applied AI Engineer roles find, import, and evaluate relevant jobs.

This enhancement refactors the existing **Import Job** page into a broader **Add Job** or **Find or Import Job** hub.

The enhanced flow should support three job intake methods:

1. **Search AI Jobs** — user does not have a specific job yet and wants ApplyWise to find relevant AI-related jobs.
2. **Import from URL** — user already has a job posting URL.
3. **Paste Job Description** — user manually pastes a job description when URL import fails or is unavailable.

All three paths should pass through the same AI validation layer:

```text
Job Intake
→ Job Extraction / Normalization
→ AI Role Relevance Check
→ Candidate Quick Match Preview
→ Save / Analyze / Apply
```

This makes ApplyWise feel less like a passive resume analyzer and more like an AI job-hunting assistant for software engineers transitioning into AI roles.

---

## 2. Product Problem

### Current Problem

The existing job intake flow is too narrow if it only supports importing a job by URL or pasting a job description. Users who are transitioning into AI engineering often do not know exactly which job titles to search for or which roles are realistic transition targets.

They may encounter roles such as:

- AI Engineer
- Applied AI Engineer
- LLM Engineer
- Generative AI Engineer
- AI Product Engineer
- Software Engineer, AI Platform
- Backend Engineer, AI Product
- ML Engineer
- Research Scientist
- AI Data Annotator

These roles are not equally relevant for a software engineer transitioning into AI engineering.

### Business Problem

A general job search page is not enough. ApplyWise should help users answer:

1. Is this job actually AI-related?
2. Is this an engineering role or a non-engineering AI role?
3. Is this role transition-friendly for a software engineer?
4. Should the user save, analyze, apply, or use the job as a learning target?

### Product Goal

Create a unified **Add Job** experience that helps users find or import jobs and automatically filters/classifies them based on AI engineering relevance before running deeper candidate matching.

---

## 3. Recommended Naming

### Current Concept

```text
Import Job
```

### Recommended User-Facing Name

```text
Add Job
```

or

```text
Find or Import Job
```

### Recommended Route

```text
/jobs/add
```

### Reasoning

The word **Import** only describes one action: bringing in an existing job. The enhanced page supports multiple job intake methods, so **Add Job** is clearer and more scalable.

---

## 4. Target Users

### Primary User

Software engineers who want to transition into AI-related engineering roles.

Typical user goals:

- Find AI-related software engineering jobs.
- Avoid generic software jobs that do not help their AI transition.
- Avoid research-heavy jobs that require ML research or PhD-level background.
- Identify jobs that are realistic transition targets.
- Analyze job fit based on their current profile.
- Generate tailored application materials after saving/analyzing the job.

---

## 5. Product Principles

### Principle 1 — Add Job is an Intake Hub

The user should not need to choose between many separate pages. The page should support all job intake methods in one place.

### Principle 2 — AI Relevance and Candidate Match Are Different

The system must distinguish between:

```text
AI Role Relevance:
Is this job actually related to AI engineering?

Candidate Match:
Is this job a good fit for this user's current profile?
```

A job can be AI-related but not a good fit. A job can match the user's backend experience but not be relevant to AI transition.

### Principle 3 — Search Should Be AI-Focused by Default

ApplyWise is not a general job board. It is focused on helping developers move toward AI engineering.

Default filters should favor:

- Applied AI Engineer
- LLM Engineer
- Generative AI Engineer
- AI Product Engineer
- Backend/Full-stack AI Engineer
- AI Platform Engineer

### Principle 4 — Manual Import Must Still Exist

Some job boards block scraping or provide limited structured data. URL import and manual paste remain critical fallback paths.

### Principle 5 — Do Not Auto-Analyze Everything

The page should use lightweight classification and quick match previews first. Full analysis should run when the user explicitly saves/analyzes a job.

---

## 6. Proposed Page Structure

### Page Route

```text
/jobs/add
```

### Page Title

```text
Add Job to ApplyWise
```

### Subtitle

```text
Search AI-related jobs or import a job you already found. ApplyWise will check whether the role fits your AI Engineer path.
```

### Intake Tabs / Cards

```text
1. Search AI Jobs
2. Import Job URL
3. Paste Job Description
```

### Recommended Default Tab

```text
Search AI Jobs
```

Reason: ApplyWise is positioned as a career assistant for software engineers transitioning into AI roles, so it should proactively help users find relevant opportunities.

---

## 7. High-Level User Flow

```text
User opens Add Job page
    ↓
User chooses intake method
    ↓
System obtains job data
    ↓
System normalizes job data
    ↓
System runs AI Role Relevance Check
    ↓
System runs lightweight Candidate Quick Match Preview
    ↓
System shows recommendation and actions
    ↓
User chooses Save, Analyze, or Open Apply Link
```

---

## 8. Intake Mode 1 — Search AI Jobs

### Description

This mode allows users to search live job listings from a public job API provider and filter them for AI engineering relevance.

This is not a general job search experience. The default behavior should focus on jobs that help a software engineer transition into AI engineering.

### Search Fields

MVP fields:

```text
Target Role / Keyword
Location
Remote Only toggle
Experience Level
```

Future fields:

```text
Employment Type
Salary Range
Date Posted
Company Type
Exclude Research-heavy Roles
Exclude Non-engineering AI Roles
```

### Default Filters

```text
Target Path: Applied AI Engineer
Only show AI-related jobs: ON
Hide research-heavy roles: ON
Hide non-engineering AI jobs: ON
Prioritize transition-friendly roles: ON
```

### Suggested Placeholder

```text
Applied AI Engineer, LLM Engineer, AI Product Engineer...
```

### Search Pipeline

```text
Search jobs from provider
→ Normalize external jobs
→ Local AI keyword pre-filter
→ AI Role Relevance Filter
→ Candidate Quick Match Preview
→ Display results
```

### Job Card Fields

Each result should show:

```text
Role title
Company
Location
Source
AI Relevance
Transition Friendliness
Quick Match Score
Short assistant summary
Recommended action
Actions: Save, Analyze, Open Apply Link
```

### Example Card

```text
Applied AI Engineer
Company: Example AI
Location: Remote US

AI relevance: Strong
Transition fit: Good for software engineers
Quick match: 72%

ApplyWise summary:
This role focuses on building LLM-powered product features and backend AI workflows. It is relevant to your AI Engineer transition path, but your profile needs stronger RAG/vector database evidence.

Actions:
[Save] [Analyze] [Open Apply Link]
```

---

## 9. Intake Mode 2 — Import Job URL

### Description

This mode supports users who already found a job posting externally and want to import it into ApplyWise.

### Flow

```text
User pastes job URL
→ System fetches/extracts job content
→ System normalizes extracted job details
→ System shows extracted preview
→ System runs AI Role Relevance Check
→ System runs Candidate Quick Match Preview
→ User confirms Save / Analyze / Cancel
```

### Important UX Requirement

Do not immediately run full analysis after importing. First show a preview and ask the user to confirm.

### Extracted Preview Example

```text
ApplyWise found this job:

Title: Forward Deployed AI Engineer
Company: Grail
Location: Remote

AI relevance: Strong
Transition friendliness: Medium
Research-heavy: No

[Save & Analyze] [Save Only] [Cancel]
```

### Non-AI-Related Job Example

```text
This job does not look strongly related to AI engineering.

It appears to be a general backend role with limited AI/LLM responsibilities.

[Add Anyway] [Find AI-related jobs instead]
```

### Business Rules

- URL import should support company career pages and common job boards when possible.
- If extraction fails, the user should be redirected to paste the job description manually.
- The system should not invent missing job fields.
- If apply URL is available, store it as the original source URL.

---

## 10. Intake Mode 3 — Paste Job Description

### Description

This mode supports users when URL import fails or when they already copied the job description text.

### Flow

```text
User pastes job description
→ AI extracts job title, company, location, requirements, responsibilities
→ AI Role Relevance Check runs
→ Candidate Quick Match Preview runs
→ User confirms Save / Analyze / Cancel
```

### User-Facing Copy

```text
Paste the full job description. ApplyWise will extract the role details and check whether it fits your AI Engineer path.
```

### Required Extracted Fields

```text
Job title
Company name if available
Location if available
Employment type if available
Responsibilities
Required skills
Preferred skills
AI/LLM-related requirements
Seniority signals
Original pasted text
```

### Business Rules

- If title or company cannot be extracted confidently, ask the user to confirm/edit before saving.
- If job description is too short, show a validation message.
- If job is not AI-related, allow Add Anyway but recommend searching AI-related jobs.

---

## 11. AI Role Relevance Filter

### Description

The AI Role Relevance Filter determines whether a job is truly relevant to the ApplyWise product vision: helping software engineers transition into AI engineering roles.

This filter should run before candidate match analysis.

### Key Question

```text
Is this job meaningfully related to AI engineering, Applied AI, LLM products, AI platforms, AI agents, RAG, or GenAI software development?
```

### Do Not Confuse With Candidate Match

AI Role Relevance is about the job itself. Candidate Match is about the user's fit.

Example:

```text
ML Research Scientist
AI-related: Yes
Transition-friendly: Low
Candidate match: likely low for typical software engineer

Backend Engineer at AI Startup
AI-related: Maybe no
Transition-friendly: Maybe medium
Candidate match: may be high but not ideal for AI transition
```

---

## 12. AI Role Categories

### Strong Target Categories

These should be included by default:

```text
Applied AI Engineer
AI Engineer
Generative AI Engineer
LLM Engineer
AI Application Engineer
AI Product Engineer
Software Engineer, AI
Backend Engineer, AI Platform
Full Stack Engineer, AI Product
AI Tools Engineer
Developer Productivity AI Engineer
```

### Good Transition Target Categories

These should usually be included:

```text
Backend Engineer with LLM/RAG responsibilities
Full Stack Engineer building AI product features
Software Engineer, ML Platform
AI Workflow Engineer
AI Infrastructure Engineer with application-level AI scope
```

### Harder / Optional Categories

These may be included only when user allows research-heavy or ML-heavy jobs:

```text
Machine Learning Engineer
ML Research Engineer
Data Scientist
Computer Vision Engineer
NLP Research Scientist
Research Scientist
```

### Usually Excluded Categories

These should be hidden by default:

```text
Data Analyst
BI Analyst
AI Content Writer
AI Trainer
AI Data Annotator
Prompt Evaluator
Sales AI Role
Marketing AI Role
Generic backend job with no AI responsibilities
Generic software job at an AI company but no AI work
```

---

## 13. AI Role Relevance Output Schema

The AI classifier should return structured JSON.

```json
{
  "is_ai_related": true,
  "ai_relevance_score": 86,
  "ai_role_category": "applied_ai_engineer",
  "transition_friendliness": "high",
  "research_heavy": false,
  "engineering_focused": true,
  "relevance_reason": "The role focuses on building LLM-powered product features, RAG workflows, and production AI integrations.",
  "detected_ai_keywords": ["LLM", "RAG", "OpenAI API", "vector database"],
  "exclude_reason": null
}
```

### Allowed Values

```text
is_ai_related: true | false
ai_relevance_score: 0-100
transition_friendliness: high | medium | low
research_heavy: true | false
engineering_focused: true | false
```

### Suggested `ai_role_category` Values

```text
applied_ai_engineer
llm_engineer
generative_ai_engineer
ai_product_engineer
ai_platform_engineer
backend_ai_engineer
fullstack_ai_engineer
ml_engineer
ml_research
ai_adjacent_engineering
not_ai_engineering
non_engineering_ai
unknown
```

### Suggested `exclude_reason` Values

```text
not_ai_related
non_engineering_ai_role
research_heavy_role
data_or_analytics_role
generic_software_role
insufficient_job_data
```

---

## 14. Local Pre-Filter Before AI

### Description

To reduce AI cost and latency, the system should use deterministic keyword-based pre-filtering before calling the AI classifier.

### Keyword Groups

#### AI Core

```text
AI
artificial intelligence
machine learning
ML
deep learning
GenAI
generative AI
```

#### LLM

```text
LLM
large language model
OpenAI
Claude
Gemini
Anthropic
LangChain
LlamaIndex
```

#### RAG / Retrieval

```text
RAG
retrieval augmented generation
vector database
embeddings
semantic search
pgvector
Pinecone
Weaviate
Chroma
FAISS
```

#### Agents / Automation

```text
AI agent
agents
tool calling
function calling
workflow automation
autonomous workflows
multi-agent
```

#### Engineering Signals

```text
API
backend
full-stack
platform
production
deployment
evaluation
observability
system design
```

#### Exclusion / Noise Signals

```text
AI content reviewer
AI data annotator
AI trainer
sales
marketing
business analyst
data entry
labeling
content moderation
```

### Cost-Safe Pipeline

```text
Fetch up to 50 jobs
→ Local keyword/pre-score all results
→ Pick top 20 likely AI-related jobs
→ AI classify top 20
→ Keep jobs with AI relevance score >= threshold
→ Run Candidate Quick Match Preview on top 5-8 jobs
```

### Suggested Thresholds

```text
AI relevance >= 75: Strong AI-related
AI relevance 60-74: Possibly AI-related
AI relevance < 60: Hide by default
```

---

## 15. Candidate Quick Match Preview

### Description

After a job passes AI Role Relevance Filter, the system should run a lightweight candidate match preview.

This is not the full analysis package. It is a quick preview to help the user decide whether to save/analyze the job.

### Quick Match Output

```json
{
  "preview_match_score": 72,
  "match_label": "possible",
  "assistant_preview": "This role is relevant to your AI Engineer transition path, but your profile needs stronger evidence around RAG and vector databases.",
  "top_matching_skills": ["Backend APIs", "SQL", "Software engineering experience"],
  "top_missing_skills": ["RAG", "Vector databases", "LLM evaluation"],
  "recommended_action": "save_and_analyze"
}
```

### Allowed `match_label` Values

```text
strong
possible
weak
limited_data
```

### Allowed `recommended_action` Values

```text
save_and_analyze
save_for_later
use_as_learning_target
skip
```

---

# 16. Epics and User Stories

---

## Epic 1 — Refactor Import Job into Add Job Hub

### User Story 1.1 — Rename and Reposition Import Job Page

As a user, I want one clear page where I can add a job to ApplyWise so that I do not need to understand whether I should search, import, or paste a job.

#### Acceptance Criteria

```text
Given I navigate to the job intake page
Then the page title should be "Add Job to ApplyWise" or "Find or Import Job"

Given the page loads
Then I should see three intake options:
- Search AI Jobs
- Import Job URL
- Paste Job Description

Given I select an intake option
Then the page should show the relevant form for that option

Given I previously used Import Job
Then existing URL import behavior should remain available under Import Job URL
```

#### Business Rules

```text
- Do not remove existing URL import functionality.
- Do not force users to search if they already have a job URL.
- Do not force users to paste JD if URL import succeeds.
```

---

## Epic 2 — Search AI Jobs Intake Mode

### User Story 2.1 — Search AI-Related Jobs

As a software engineer transitioning into AI engineering, I want to search for AI-related jobs directly inside ApplyWise so that I can find relevant opportunities without leaving the app.

#### Acceptance Criteria

```text
Given I open Add Job
When I choose Search AI Jobs
Then I can enter a target role and location

Given I submit a search
Then the system should call the configured job search provider

Given jobs are returned
Then the system should normalize and display the job results

Given no jobs are returned
Then the UI should show an empty state with suggestions to broaden the search

Given the provider fails
Then the UI should show a retry option and suggest Import URL or Paste JD as alternatives
```

#### Default Values

```text
Target path: Applied AI Engineer
Only show AI-related jobs: ON
Hide research-heavy roles: ON
Hide non-engineering AI jobs: ON
```

---

### User Story 2.2 — Display AI-Focused Job Results

As a user, I want job results to show AI relevance and transition friendliness so that I can quickly understand whether a job is worth reviewing.

#### Acceptance Criteria

```text
Given search results are displayed
Then each job card should show:
- role title
- company
- location
- source
- AI relevance label
- transition friendliness
- quick match score if available
- short assistant summary
- recommended action

Given a job is strongly AI-related
Then it should be visually marked as a strong AI-related role

Given a job is only possibly AI-related
Then it should be marked as possible or AI-adjacent

Given a job is not AI-related
Then it should be hidden by default
```

---

## Epic 3 — Import Job URL Enhancement

### User Story 3.1 — Import Job from URL with AI Relevance Preview

As a user, I want to import a job URL and preview whether it is AI-related before saving or analyzing it.

#### Acceptance Criteria

```text
Given I paste a job URL
When the system extracts job content
Then it should show a preview of the extracted job

The preview should include:
- title
- company
- location
- source URL
- AI relevance label
- transition friendliness
- research-heavy indicator
- engineering-focused indicator

Given extraction succeeds
Then I should be able to Save Only, Save & Analyze, or Cancel

Given extraction fails
Then I should be offered the option to paste the job description manually
```

---

### User Story 3.2 — Warn When Imported Job Is Not AI-Related

As a user, I want ApplyWise to warn me when an imported job is not strongly related to AI engineering so that I do not waste time analyzing jobs that do not match my goal.

#### Acceptance Criteria

```text
Given I import a job URL
And the AI Role Relevance Filter determines the job is not AI-related
Then the system should show a warning message

Given the warning is shown
Then I should still be able to Add Anyway

Given the warning is shown
Then I should also be able to choose Find AI-related jobs instead
```

#### Example Warning

```text
This job does not look strongly related to AI engineering.
It appears to be a general backend role with limited AI/LLM responsibilities.
```

---

## Epic 4 — Paste Job Description Enhancement

### User Story 4.1 — Paste JD and Extract Job Details

As a user, I want to paste a job description so that ApplyWise can extract job details even when URL import fails.

#### Acceptance Criteria

```text
Given I choose Paste Job Description
Then I can paste a full job description into a text area

Given I submit the pasted JD
Then the system should extract:
- job title
- company if available
- location if available
- responsibilities
- required skills
- preferred skills
- AI/LLM-related requirements
- seniority signals

Given important fields are missing
Then the UI should ask me to confirm or edit them before saving
```

---

### User Story 4.2 — Run AI Relevance Check on Pasted JD

As a user, I want ApplyWise to check whether a pasted job description is AI-related so that I know whether it fits my AI Engineer transition path.

#### Acceptance Criteria

```text
Given I paste a job description
When extraction completes
Then the AI Role Relevance Filter should run

Given the role is AI-related
Then the UI should show its AI relevance and transition friendliness

Given the role is not AI-related
Then the UI should show a warning and allow Add Anyway
```

---

## Epic 5 — AI Role Relevance Filter

### User Story 5.1 — Classify Job AI Relevance

As a user, I want ApplyWise to identify whether a job is truly AI-related so that I only spend time on jobs that support my transition into AI engineering.

#### Acceptance Criteria

```text
Given a normalized job is available
When AI Role Relevance Check runs
Then it should classify whether the job is AI-related

Given the job focuses on LLM, RAG, AI product, AI platform, AI agents, or applied AI engineering
Then it should be included

Given the job only mentions working at an AI company but has no AI engineering responsibilities
Then it should not be included by default

Given the job is non-engineering AI work such as data annotation or AI content review
Then it should be excluded by default

Given the job is research-heavy
Then it should be marked as research-heavy
```

---

### User Story 5.2 — Show Why a Job Is AI-Related

As a user, I want to see why a job is considered AI-related so that I can trust the filtering decision.

#### Acceptance Criteria

```text
Given a job passes the AI Role Relevance Filter
Then the UI should show a short explanation

Given AI keywords are detected
Then the UI should show the most important detected AI-related keywords

Given a job is excluded
Then the system should store the exclude reason internally

Given user enables "Show hidden jobs"
Then excluded jobs can be displayed with their exclude reason
```

---

## Epic 6 — Candidate Quick Match Preview

### User Story 6.1 — Generate Quick Match Preview After AI Relevance

As a user, I want a quick match preview for AI-related jobs so that I can decide whether to save or analyze the job.

#### Acceptance Criteria

```text
Given a job passes AI Role Relevance Filter
And I have an active candidate profile
Then the system should generate a quick match preview

Given quick match preview succeeds
Then the UI should show:
- match score
- match label
- assistant preview
- top matching skills
- top missing skills
- recommended action

Given quick match preview fails
Then the job should still be displayed
And the preview area should show "Match preview unavailable"
```

---

### User Story 6.2 — Keep Quick Match Lightweight

As a product owner, I want the system to limit AI calls during search so that the product remains fast and cost-efficient.

#### Acceptance Criteria

```text
Given the provider returns many jobs
Then the system should not run full analysis on all jobs

Given 50 jobs are fetched
Then the system should use local pre-filtering first

Given pre-filtering completes
Then AI Role Relevance should run only on the top likely AI-related jobs

Given AI Role Relevance completes
Then Candidate Quick Match should run only on the top relevant jobs
```

---

## Epic 7 — Save / Analyze / Apply Actions

### User Story 7.1 — Save a Job from Any Intake Mode

As a user, I want to save a job from search, URL import, or pasted JD so that I can revisit and analyze it later.

#### Acceptance Criteria

```text
Given a job is displayed from any intake mode
When I click Save
Then the job should be saved to my job list

Given the job came from search
Then its source should be stored as discovered_api

Given the job came from URL import
Then its source should be stored as manual_url

Given the job came from pasted JD
Then its source should be stored as manual_paste

Given the job has AI relevance data
Then the AI relevance result should be saved with the job

Given the job has quick match data
Then the quick match result should be saved with the job
```

---

### User Story 7.2 — Save and Analyze a Job

As a user, I want to save and analyze a job in one action so that I can immediately understand whether I should apply.

#### Acceptance Criteria

```text
Given a job is displayed from any intake mode
When I click Save & Analyze
Then the system should save the job if it is not already saved
And run the full Job Analysis Package

Given analysis completes
Then I should be routed to the Job Analysis page

Given analysis fails
Then the job should remain saved
And I should be able to retry analysis
```

---

### User Story 7.3 — Open Apply Link

As a user, I want to open the original apply link so that I can apply directly on the company or source website.

#### Acceptance Criteria

```text
Given a job has an apply URL
When I click Open Apply Link
Then the URL should open in a new tab

Given a job does not have an apply URL
Then the Open Apply Link action should be disabled

Given I open an apply link
Then the system should create an activity record
```

---

## Epic 8 — Data Model Enhancements

### User Story 8.1 — Store Job Intake Source and AI Relevance Data

As a system, I need to store how a job was added and how it was classified so that job history and analysis remain explainable.

#### Suggested Job Fields

```sql
alter table jobs
add column source text default 'manual_paste',
add column external_source text,
add column external_job_id text,
add column external_apply_url text,
add column external_posted_at timestamptz,
add column external_raw_payload jsonb,
add column ai_relevance_score int,
add column ai_role_category text,
add column ai_relevance_label text,
add column transition_friendliness text,
add column research_heavy boolean default false,
add column engineering_focused boolean default true,
add column ai_relevance_json jsonb,
add column quick_match_score int,
add column quick_match_label text,
add column quick_match_summary text,
add column quick_match_json jsonb;
```

### Allowed `source` Values

```text
discovered_api
manual_url
manual_paste
```

---

## Epic 9 — API Enhancements

### User Story 9.1 — Add Unified Job Intake APIs

As a developer, I want clear APIs for each job intake method so that the frontend can support search, URL import, and pasted JD consistently.

#### Suggested APIs

```http
POST /api/jobs/search-ai
POST /api/jobs/import-url
POST /api/jobs/extract-from-description
POST /api/jobs/:jobId/analyze
POST /api/jobs/save-external
```

---

### Search AI Jobs API

```http
POST /api/jobs/search-ai
```

Request:

```json
{
  "target_role": "Applied AI Engineer",
  "location": "Remote US",
  "remote_only": true,
  "experience_level": "mid",
  "filters": {
    "only_ai_related": true,
    "hide_research_heavy": true,
    "hide_non_engineering_ai": true,
    "prioritize_transition_friendly": true
  }
}
```

Response:

```json
{
  "search_session_id": "uuid",
  "total_provider_results": 50,
  "total_ai_related_results": 12,
  "jobs": [
    {
      "external_job_id": "string",
      "external_source": "adzuna",
      "title": "Applied AI Engineer",
      "company": "Example AI",
      "location": "Remote US",
      "description": "string",
      "apply_url": "string",
      "ai_relevance": {
        "is_ai_related": true,
        "ai_relevance_score": 86,
        "ai_role_category": "applied_ai_engineer",
        "transition_friendliness": "high",
        "research_heavy": false,
        "engineering_focused": true,
        "relevance_reason": "string",
        "detected_ai_keywords": []
      },
      "quick_match": {
        "preview_match_score": 72,
        "match_label": "possible",
        "assistant_preview": "string",
        "recommended_action": "save_and_analyze"
      }
    }
  ]
}
```

---

## Epic 10 — Error Handling and Empty States

### User Story 10.1 — Provider Failure Handling

As a user, I want helpful fallback options when job search fails so that I can still add a job manually.

#### Acceptance Criteria

```text
Given the job search provider fails
Then the UI should show a user-friendly error

Given the error is shown
Then the UI should offer:
- Retry search
- Import Job URL
- Paste Job Description
```

---

### User Story 10.2 — No AI-Related Jobs Found

As a user, I want useful guidance when no AI-related jobs are found so that I know how to broaden my search.

#### Acceptance Criteria

```text
Given search completes
And no AI-related jobs are found
Then the UI should show an empty state

The empty state should suggest:
- Try a broader role like Software Engineer, AI Product
- Disable Hide Research-heavy Roles
- Disable Only AI-related Jobs
- Try Remote US instead of a narrow city
```

---

## Epic 11 — Activity Tracking

### User Story 11.1 — Track Job Intake Activities

As a user, I want my job intake actions to appear in activity history so that I can understand what I have done.

#### Acceptance Criteria

```text
Given I search AI jobs
Then an activity event should be created

Given I import a job URL
Then an activity event should be created

Given I paste a job description
Then an activity event should be created

Given I save a job
Then an activity event should be created

Given I open an apply link
Then an activity event should be created
```

---

# 17. UX Copy Recommendations

## Page Header

```text
Add Job to ApplyWise
```

## Page Subtitle

```text
Search AI-related jobs or import a job you already found. ApplyWise will check whether the role fits your AI Engineer path.
```

## Tab Labels

```text
Search AI Jobs
Import Job URL
Paste Job Description
```

## Filter Labels

```text
Only show AI-related jobs
Hide research-heavy roles
Hide non-engineering AI roles
Prioritize transition-friendly jobs
```

## Warning Copy

```text
This job does not look strongly related to AI engineering. You can still add it, but ApplyWise recommends focusing on roles with clear AI, LLM, RAG, or AI product responsibilities.
```

## Empty State Copy

```text
No strong AI-related jobs found. Try broadening your role keywords, switching to Remote US, or showing AI-adjacent roles.
```

---

# 18. Definition of Done

This enhancement is complete when:

```text
- Existing Import Job page is refactored into Add Job / Find or Import Job page.
- Page supports Search AI Jobs, Import Job URL, and Paste Job Description.
- Search AI Jobs integrates with a public job provider or existing job search service.
- Jobs from all intake modes are normalized into a consistent internal format.
- AI Role Relevance Check runs before Candidate Match.
- AI Role Relevance output is stored and displayed.
- Candidate Quick Match Preview runs only for AI-relevant jobs or selected jobs.
- User can Save, Save & Analyze, or Open Apply Link.
- Non-AI-related jobs are warned or hidden by default, but user can still add them manually.
- Research-heavy and non-engineering AI jobs are hidden by default for the Applied AI Engineer transition path.
- Provider/search errors offer fallback options.
- Activity events are created for search/import/save/apply actions.
- Existing deep Job Analysis flow still works after saving/analyzing a job.
```

---

# 19. Final Requirement Statement

Enhance the existing Import Job feature into a unified **Add Job / Find or Import Job** hub. The page must support searching AI-related jobs, importing a job URL, and pasting a job description. All intake methods must normalize job data, run an AI Role Relevance Check, and provide a lightweight Candidate Quick Match Preview before the user saves or analyzes the job. The system should default to AI-focused, transition-friendly roles for software engineers moving into AI engineering and should hide research-heavy or non-engineering AI roles unless the user chooses to include them.
