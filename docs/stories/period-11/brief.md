# Period 11 Brief — Refactor Job Analysis Flow into Decision-Based AI Assistant Experience

Verbatim user requirement (2026-06-10), copied from
`applywise_job_analysis_flow_refactor_user_stories.md` at the repo root. This
document is input material for traceability; the accepted direction will live
in the Period 11 README, the story packets, and a decision record created when
implementation starts.

---

# ApplyWise Enhancement — Refactor Job Analysis Flow into Decision-Based AI Assistant Experience

## Document Purpose

This document defines user stories and detailed acceptance criteria for refactoring the current **Analyze Match / Job Analysis** experience in ApplyWise.

The current implementation exposes too many AI modules and technical workflow controls directly to the user, such as:

- Generate insight
- Generate analysis
- AI workflow
- Skill gap analysis
- Resume suggestions
- Resume draft
- Draft CV
- Cover letter
- 4-week roadmap
- Interview prep

This creates a confusing experience because users do not immediately understand what they should do next.

The refactor should reposition the page around the core ApplyWise product vision:

> ApplyWise should behave like an AI job assistant that helps the user decide whether to apply, improve first, use the job as a learning target, or skip the role.

The page should answer three questions clearly:

1. Should I apply?
2. Why?
3. What should I do next?

Everything else should support those answers.

---

## Current Problems

### Problem 1 — Too Many Competing AI Concepts

The current page includes multiple overlapping concepts:

- AI job assistant
- AI assistant summary
- Generate insight
- Regenerate analysis
- AI workflow
- Analysis basis
- Match analysis

Users cannot easily understand the difference between these actions or sections.

### Problem 2 — AI Workflow Is Too Technical for Main User Flow

The AI workflow panel displays internal steps such as:

- Resume Profile Extraction
- Job Import
- Job Requirement Extraction
- AI Match Analysis
- Missing Skill Analysis
- Tailored Resume

This is useful for debugging and transparency, but it should not be the main user-facing experience.

### Problem 3 — Recommendation Does Not Guide Enough

The current recommendation may say the user should not apply, but it does not sufficiently guide the user toward a practical next move.

A strong assistant should explain:

- Whether the job is worth applying to
- What skills or evidence are missing
- Whether the user should generate a resume or not
- Whether the job should become a learning target
- What the user should do next

### Problem 4 — All Actions Are Displayed Equally

The current right-side action list shows many actions regardless of match quality:

- Save to tracker
- Skill gap analysis
- Resume suggestions
- Resume draft
- Draft CV
- Cover letter
- 4-week roadmap
- Interview prep

This is not recommendation-based. For a low match / high-risk role, actions like Draft CV and Cover Letter should not be primary.

### Problem 5 — Duplicate Regeneration Buttons

The UI currently has multiple regenerate actions, such as:

- Regenerate insight
- Regenerate analysis
- Regenerate workflow steps

For normal users, this is confusing. The main page should expose one clear action: **Refresh Analysis**.

---

## Product Direction

Refactor the Job Analysis page from a module-output dashboard into a decision-based AI assistant experience.

The page should be organized around:

1. Decision Header
2. AI Recommendation Summary
3. Evidence Summary
4. Recommendation-Based Next Actions
5. Detailed Analysis Tabs
6. Advanced Analysis Details

---

## Recommended Decision Labels

The system should classify each job into one of the following user-facing decision labels:

| Decision Label | Meaning |
|---|---|
| Strong Apply Target | The user is a strong fit and should prepare application materials. |
| Apply With Improvements | The user can apply, but should tailor resume or address some gaps first. |
| Learning Target | The role is directionally useful, but the user should build skills/evidence before applying. |
| Not Recommended | The role is too far from the user profile or has high-risk missing requirements. |

Avoid vague labels like:

- Low priority
- Bad match
- Weak candidate

Prefer labels that guide action.

---

## Recommended Decision Rules

### Strong Apply Target

Use when:

- Overall score is 80 or higher
- Critical gaps are low
- Risk level is low or medium
- Resume can be safely tailored with existing evidence

Recommended actions:

- Generate Draft CV
- Generate Cover Letter
- Prepare Interview
- Open Apply Link
- Save to Tracker

### Apply With Improvements

Use when:

- Overall score is 60–79
- Some important gaps exist
- Resume can be improved safely
- The user has enough evidence to apply after tailoring

Recommended actions:

- Review Resume Strategy
- Generate Resume Suggestions
- Generate Draft CV
- Review Skill Gaps
- Generate Cover Letter

### Learning Target

Use when:

- Overall score is 35–59
- The role is directionally relevant
- The user lacks important evidence or hands-on skills
- Applying now may be premature

Recommended actions:

- Generate 4-Week Roadmap
- Save as Learning Target
- Update Professional Profile
- Find Similar Easier Roles

### Not Recommended

Use when:

- Overall score is below 35
- Critical required skills are missing
- Resume cannot be safely tailored without unsupported claims
- Risk level is high

Recommended actions:

- Find Better Matches
- Save as Reference
- Generate Roadmap only if the role is relevant to the user’s future target

---

# Epic 1 — Unified Job Analysis Overview

## User Story 1.1 — Display One Clear Job Decision

As a user, I want to see one clear recommendation for a job so that I immediately understand whether I should apply, improve first, use the job as a learning target, or skip it.

### Acceptance Criteria

Given a job has been analyzed  
When I open the Job Analysis page  
Then I should see one primary decision label:

- Strong Apply Target
- Apply With Improvements
- Learning Target
- Not Recommended

Given the decision label is displayed  
Then I should also see:

- Overall match score
- Risk level
- Confidence level
- Short assistant explanation

Given the role is a weak match  
Then Draft CV and Cover Letter should not be shown as primary actions.

Given the role is a strong match  
Then application material actions should become primary actions.

### UI Guidance

Example for weak role:

```text
Not Recommended Yet
27% match · High risk · Confidence 60%

ApplyWise recommends using this role as a learning target instead of applying now.
This role requires RAG, vector databases, and AI agent experience, but your current profile does not show evidence for those skills.
```

Example for strong role:

```text
Strong Apply Target
86% match · Low risk · Confidence 82%

ApplyWise recommends preparing application materials for this role. Your backend experience, API work, and production project history align well with the job requirements.
```

---

## User Story 1.2 — Replace Module-Based Summary with Assistant Recommendation

As a user, I want the analysis page to explain the recommendation in plain English so that I do not need to interpret raw model/module outputs.

### Acceptance Criteria

Given the analysis package is available  
When the page renders  
Then the top recommendation card should explain:

- Whether I should apply
- Why this recommendation was made
- What the main missing or matching evidence is
- What I should do next

Given model/debug information exists  
Then it should not appear in the main assistant summary.

Given the user wants technical details  
Then they can open Advanced Analysis Details.

### User-Facing Copy Rules

Do not show technical text like:

```text
Generated by deterministic baseline analyzer.
Configure model for evidence-based reasoning.
```

Instead, show:

```text
ApplyWise reviewed your saved profile, resume evidence, and this job description to estimate your fit.
```

---

# Epic 2 — Recommendation-Based Next Actions

## User Story 2.1 — Show Next Actions Based on Decision

As a user, I want ApplyWise to show the most relevant next actions based on the job recommendation so that I know what to do next without guessing.

### Acceptance Criteria

Given a job is classified as Strong Apply Target  
Then the primary action should be Generate Draft CV.

Given a job is classified as Apply With Improvements  
Then the primary action should be Review Resume Strategy or Generate Resume Suggestions.

Given a job is classified as Learning Target  
Then the primary action should be Generate 4-Week Roadmap.

Given a job is classified as Not Recommended  
Then the primary action should be Find Better Matches or Save as Reference.

Given an action is not appropriate for the current decision  
Then the action should be hidden, disabled, or moved under Advanced Actions.

### Recommended Action Mapping

#### Strong Apply Target

Primary actions:

- Generate Draft CV
- Generate Cover Letter
- Prepare Interview
- Open Apply Link

Secondary actions:

- Save to Tracker
- View Skill Gaps
- Refresh Analysis

#### Apply With Improvements

Primary actions:

- Review Resume Strategy
- Generate Resume Suggestions
- Generate Draft CV

Secondary actions:

- Review Skill Gaps
- Generate Cover Letter
- Prepare Interview

#### Learning Target

Primary actions:

- Generate 4-Week Roadmap
- Save as Learning Target
- Update Professional Profile

Secondary actions:

- Find Better Matches
- View Skill Gaps
- Generate Materials Anyway

#### Not Recommended

Primary actions:

- Find Better Matches
- Save as Reference

Secondary actions:

- View Skill Gaps
- Generate Roadmap
- Generate Materials Anyway

---

## User Story 2.2 — Material Readiness Rules

As a user, I want ApplyWise to tell me whether generating application materials is appropriate so that I do not waste time producing resumes or cover letters for jobs I should not apply to.

### Acceptance Criteria

Given the job is Strong Apply Target  
Then Draft CV and Cover Letter actions should be available as primary actions.

Given the job is Apply With Improvements  
Then Draft CV should be available after resume strategy/suggestions are reviewed.

Given the job is Learning Target  
Then Draft CV and Cover Letter should not be primary actions.

Given the job is Not Recommended  
Then Draft CV and Cover Letter should be hidden, disabled, or placed under Advanced Actions.

Given the user still wants to generate materials for a weak match  
Then they can choose Generate Anyway.

Given the user chooses Generate Anyway  
Then the UI must warn that the resume may contain limited supported evidence.

### Example Warning

```text
This role is not recommended yet. Your profile does not show evidence for several critical requirements. You can still generate a draft CV, but ApplyWise may exclude unsupported claims.
```

---

# Epic 3 — Simplify Regeneration Controls

## User Story 3.1 — Replace Duplicate Regenerate Buttons with Refresh Analysis

As a user, I want one clear way to refresh the analysis so that I am not confused by multiple regenerate buttons.

### Acceptance Criteria

Given I am on the Job Analysis page  
Then I should see one primary button called Refresh Analysis.

Given I click Refresh Analysis  
Then the system should re-run the core analysis package.

Given advanced controls are needed  
Then they should be available inside Advanced Analysis Details.

Given individual workflow step regeneration exists  
Then it should not be shown as a primary action on the main page.

---

## User Story 3.2 — Define Refresh Analysis Behavior

As a user, I want Refresh Analysis to update the recommendation and next actions so that the page reflects the latest profile, resume, and job data.

### Acceptance Criteria

Given I click Refresh Analysis  
Then the system should:

1. Validate the active candidate profile
2. Validate the saved job description
3. Re-run job requirement extraction if needed
4. Re-run match scoring
5. Re-run missing skill analysis
6. Re-generate the assistant recommendation
7. Recompute next best actions
8. Update the analysis timestamp

Given I click Refresh Analysis  
Then the system should not automatically regenerate:

- Draft CV
- Cover letter
- Interview prep
- Roadmap

Those downstream artifacts should only regenerate when the user explicitly requests them.

---

# Epic 4 — Move AI Workflow to Advanced Details

## User Story 4.1 — Collapse AI Workflow by Default

As a user, I do not want technical workflow details to distract me from the recommendation, so the AI workflow should be hidden or collapsed by default.

### Acceptance Criteria

Given I open the Job Analysis page  
Then the AI workflow panel should not be expanded by default.

Given I click View Analysis Details  
Then I can see workflow steps, statuses, timestamps, model name, confidence, and errors.

Given a workflow step fails  
Then the main page should show a simple user-friendly message.

Given the user opens Advanced Analysis Details  
Then the technical failure details should be visible.

---

## User Story 4.2 — Keep Workflow Useful for Debugging

As a developer or power user, I want to inspect the AI workflow when needed so that I can understand what was generated and when.

### Acceptance Criteria

Given Advanced Analysis Details is opened  
Then it should display:

- Workflow step name
- Status
- Last run time
- Model provider
- Model name
- Confidence score
- Error message if failed
- Regenerate step action if supported

Given a step is regenerated from Advanced Details  
Then only that step should be regenerated unless dependent steps require refresh.

Given a dependent step becomes stale  
Then the UI should clearly show stale status.

---

# Epic 5 — Evidence Summary and Trust

## User Story 5.1 — Show Human Evidence Summary

As a user, I want to see the main evidence behind the recommendation so that I can trust the analysis.

### Acceptance Criteria

Given the job analysis is complete  
Then the Overview should show a section called Why ApplyWise Thinks This.

The section should include:

- Matched evidence
- Missing critical skills
- Risks
- Confidence explanation

Given the system has no evidence for a required skill  
Then it should say the skill is missing or unsupported.

Given the system has weak evidence  
Then it should mark the evidence as weak or needs confirmation.

### Example for Weak Match

```text
Matched:
- 4 years of software engineering experience
- General backend/application development experience

Missing:
- RAG
- Vector databases
- AI agents

Risk:
- The resume may satisfy experience level but fail AI skill screening.
```

---

## User Story 5.2 — Explain Confidence Clearly

As a user, I want to understand how confident ApplyWise is in the recommendation so that I can decide whether to trust it or improve my profile.

### Acceptance Criteria

Given the analysis has a confidence score  
Then the page should display the confidence level.

Given confidence is low  
Then the page should explain why confidence is low.

Possible reasons:

- Resume/profile data is incomplete
- Job description is too short
- Required skills are ambiguous
- AI model output is incomplete
- Analysis used deterministic baseline only

Given confidence is low because profile data is incomplete  
Then the next action should include Update Professional Profile.

---

# Epic 6 — Detailed Analysis Tabs

## User Story 6.1 — Organize Details into Tabs

As a user, I want detailed analysis organized into clear tabs so that I can explore more detail without being overwhelmed.

### Acceptance Criteria

Given the Job Analysis page is loaded  
Then the detailed content should be organized into tabs:

- Overview
- Skill Gaps
- Resume Strategy
- Application Materials
- Interview Prep
- Analysis Details

Given the user opens Overview  
Then they should see decision, recommendation, evidence summary, and next actions.

Given the user opens Skill Gaps  
Then they should see missing skills, importance, gap type, and how to fix.

Given the user opens Resume Strategy  
Then they should see whether resume tailoring is recommended and what changes are safe.

Given the user opens Application Materials  
Then they should see Draft CV, Cover Letter, and export readiness status.

Given the user opens Interview Prep  
Then they should see interview focus based on the job and user profile.

Given the user opens Analysis Details  
Then they should see technical workflow and score details.

---

## User Story 6.2 — Adapt Tabs Based on Recommendation

As a user, I want the page to adapt based on whether the role is worth applying to so that I only see relevant content first.

### Acceptance Criteria

Given the job is Strong Apply Target  
Then Application Materials and Interview Prep should be emphasized.

Given the job is Apply With Improvements  
Then Resume Strategy and Skill Gaps should be emphasized.

Given the job is Learning Target  
Then Skill Gaps and Roadmap should be emphasized.

Given the job is Not Recommended  
Then Overview and Find Better Matches should be emphasized.

---

# Epic 7 — Unified Analysis Package View Model

## User Story 7.1 — Backend Provides Unified Analysis Package

As a developer, I want the frontend to consume one unified analysis package so that the UI does not stitch together many disconnected AI modules.

### Acceptance Criteria

Given a job analysis exists  
When the frontend loads the page  
Then it should receive one unified analysis package view model.

The view model must include:

- Job summary
- Decision
- Scores
- Evidence
- Skill gaps
- Risks
- Next actions
- Material readiness
- Assistant copy
- Analysis details

Given individual AI modules are stored separately  
Then the backend should compose them into one user-facing package.

---

## Suggested View Model

```json
{
  "job": {
    "id": "uuid",
    "title": "AI Forward Deployed Engineer",
    "company": "grail.computer",
    "location": "Remote"
  },
  "decision": {
    "label": "not_recommended",
    "display_label": "Not Recommended Yet",
    "match_score": 27,
    "risk_level": "high",
    "confidence": 60,
    "summary": "This role is not a strong apply-now target because your profile does not show evidence for required AI skills."
  },
  "evidence": {
    "matched": [
      "4 years of software engineering experience",
      "General backend/application development experience"
    ],
    "missing": [
      "RAG",
      "Vector databases",
      "AI agents"
    ],
    "risks": [
      "Resume may pass experience level but fail AI skill screening."
    ]
  },
  "next_actions": [
    {
      "type": "roadmap",
      "label": "Generate 4-week roadmap",
      "priority": 1,
      "reason": "Close the missing AI skill gaps before applying."
    },
    {
      "type": "save_learning_target",
      "label": "Save as learning target",
      "priority": 2,
      "reason": "Use this role as a reference for skill building."
    }
  ],
  "material_readiness": {
    "draft_cv": "not_recommended",
    "cover_letter": "not_recommended",
    "reason": "The profile lacks evidence for critical role requirements."
  },
  "scores": {
    "overall": 27,
    "skill": 0,
    "experience": 100,
    "ai_readiness": 0,
    "ats_keywords": 0,
    "seniority": 70
  },
  "analysis_details": {
    "model_provider": "deterministic-baseline",
    "model_name": "deterministic-baseline",
    "last_run_at": "2026-06-09T00:00:00Z",
    "workflow_steps": []
  }
}
```

---

# Epic 8 — Refactor Current Sidebar into Next Actions

## User Story 8.1 — Replace Static Sidebar Buttons with Dynamic Next Actions

As a user, I want the sidebar to show actions that match the recommendation so that I am not overwhelmed by irrelevant buttons.

### Acceptance Criteria

Given the job is analyzed  
Then the sidebar should show Recommended Next Actions instead of a static list of all features.

Given an action is primary  
Then it should be visually emphasized.

Given an action is secondary  
Then it should be shown below primary actions.

Given an action is advanced or not recommended  
Then it should be placed under Advanced Actions.

Given the decision changes after Refresh Analysis  
Then the sidebar actions should update accordingly.

---

## Example Sidebar for Weak Match

```text
Recommended Next Actions

Primary
[Generate 4-week roadmap]

Secondary
[Save as learning target]
[Update profile with real AI evidence]
[Find better matches]

Advanced
[Generate materials anyway]
[View analysis details]
[Refresh analysis]
```

## Example Sidebar for Strong Match

```text
Recommended Next Actions

Primary
[Generate Draft CV]

Secondary
[Generate Cover Letter]
[Interview Prep]
[Save to Tracker]
[Open Apply Link]

Advanced
[View analysis details]
[Refresh analysis]
```

---

# Epic 9 — Learning Target Flow

## User Story 9.1 — Treat Weak but Relevant Roles as Learning Targets

As a user, I want to save weak but relevant roles as learning targets so that I can use them to guide skill-building.

### Acceptance Criteria

Given a job has low match score but aligns with my target career direction  
Then ApplyWise may classify it as Learning Target.

Given a job is classified as Learning Target  
Then the primary action should be Generate 4-Week Roadmap.

Given I save a job as Learning Target  
Then it should be stored in my tracker with status learning_target.

Given a job is saved as Learning Target  
Then it should not be counted as an active application.

Given a roadmap is generated from a learning target  
Then the roadmap should focus on closing the missing critical skills.

---

# Epic 10 — Resume and Cover Letter Guardrails

## User Story 10.1 — Prevent Premature Resume Generation

As a user, I want ApplyWise to warn me when a resume should not be generated for a weak job so that I do not create misleading application materials.

### Acceptance Criteria

Given the job is Not Recommended or Learning Target  
When I try to generate Draft CV  
Then the system should display a warning.

Given the user confirms Generate Anyway  
Then the system can generate a constrained draft that excludes unsupported claims.

Given unsupported job requirements exist  
Then the generated resume must not claim those skills.

Given the Draft CV is generated for a weak match  
Then the output should include a risk summary.

---

## User Story 10.2 — Show Resume Strategy Before Draft CV

As a user, I want to see the resume strategy before generating a full draft CV so that I understand what can safely be tailored.

### Acceptance Criteria

Given the user opens Resume Strategy  
Then the page should show:

- Supported keywords that can be emphasized
- Unsupported keywords that should not be claimed
- Recommended positioning
- Whether a Draft CV is recommended

Given there are no safe resume improvements  
Then the system should recommend improving profile/project evidence first.

---

# Epic 11 — Page Naming and Navigation

## User Story 11.1 — Rename Matches Page to Job Analysis

As a user, I want the page name to clearly describe what I am viewing so that the product feels intuitive.

### Acceptance Criteria

Given the user opens a job match result  
Then the page title should be Job Analysis or Role Fit Analysis.

Given the user navigates from jobs list  
Then the breadcrumb should make sense:

```text
Jobs → Job Analysis
```

Avoid using only the page title Matches because it is vague.

---

# Epic 12 — Error and Empty States

## User Story 12.1 — Incomplete Profile State

As a user, I want the analysis page to tell me when my profile is incomplete so that I can improve analysis quality.

### Acceptance Criteria

Given the user profile is missing important fields  
Then the analysis page should show a profile completeness warning.

Given missing profile data affects confidence  
Then the confidence explanation should mention profile incompleteness.

Given profile data is missing  
Then Update Professional Profile should appear as a recommended action.

---

## User Story 12.2 — Analysis Failure State

As a user, I want a clear error message if analysis fails so that I know how to recover.

### Acceptance Criteria

Given analysis fails  
Then the page should show a user-friendly error.

Given analysis fails due to missing job description  
Then the page should ask the user to re-import or paste the job description.

Given analysis fails due to AI/model issue  
Then the page should offer Refresh Analysis.

Given advanced details exist  
Then technical error information should appear only under Advanced Analysis Details.

---

# Epic 13 — Activity and Status Tracking

## User Story 13.1 — Track Analysis Decision History

As a user, I want ApplyWise to track analysis changes over time so that I can understand how my fit improves after updating my profile.

### Acceptance Criteria

Given an analysis is refreshed  
Then the system should save a new analysis run record.

Given the decision changes  
Then the system should record the previous and new decision.

Given the user updates their profile and refreshes analysis  
Then the analysis history should show that the updated profile was used.

Given analysis history exists  
Then it should be viewable in Advanced Analysis Details.

---

# Required UI Refactor Summary

## Main Page Layout

Recommended structure:

```text
Back to Jobs

[Decision Header]
Not Recommended Yet
27% match · High risk · Confidence 60%

[AI Recommendation]
ApplyWise recommends using this role as a learning target...

[Next Best Actions]
Primary: Generate 4-week roadmap
Secondary: Save as learning target
Secondary: Find better matches
Advanced: Refresh analysis

[Why this recommendation]
Matched evidence
Missing critical skills
Risks

[Tabs]
Overview | Skill Gaps | Resume Strategy | Application Materials | Interview Prep | Analysis Details
```

---

# Required Backend Refactor Summary

## Analysis Package

Create a unified user-facing analysis package that composes existing analysis modules.

The frontend should not directly assemble unrelated outputs from:

- match analysis
- assistant insight
- skill gaps
- workflow
- resume suggestions

Instead, backend should provide one composed response.

## Decision Engine

Add a decision layer that converts analysis data into:

- decision label
- risk level
- assistant summary
- recommended actions
- disabled/deprioritized actions
- material readiness

## Workflow Visibility

Keep workflow data, but expose it only as advanced details.

---

# Non-Functional Requirements

## Usability

- A first-time user should understand the recommendation within 10 seconds.
- The page should not require the user to understand AI workflow steps.
- The page should avoid showing too many equal-weight actions.

## Trust

- The system must explain key evidence behind recommendations.
- The system must not recommend generating misleading resumes.
- The system must clearly show when profile data is incomplete.

## Maintainability

- The frontend should consume a unified analysis view model.
- AI workflow internals should be decoupled from main UX.
- Decision rules should be centralized and testable.

## Cost Control

- Refresh Analysis should only regenerate the analysis package.
- Expensive downstream artifacts should regenerate only by explicit user action.

---

# Definition of Done

This enhancement is complete when:

- The page shows one clear job decision.
- The page answers: Should I apply, why, and what should I do next?
- Static action lists are replaced with recommendation-based next actions.
- Duplicate regenerate buttons are replaced by one Refresh Analysis action.
- AI workflow is moved to Advanced Analysis Details and collapsed by default.
- Draft CV and Cover Letter are only primary actions when appropriate.
- Weak but relevant jobs can be treated as Learning Targets.
- The backend provides a unified analysis package view model.
- The UI displays evidence summary, risks, confidence, and material readiness.
- The user can still access detailed workflow/debug information when needed.
- The page no longer feels like a developer pipeline dashboard.
- The page feels like an AI job assistant guiding the user toward the next best action.

---

# Final Product Principle

The Job Analysis page should not expose AI modules as the product experience.

The product experience should be:

> ApplyWise reviewed this role, compared it against your professional profile, and recommends the best next action for your career/application strategy.

The page should always optimize for clarity, trust, and action.
