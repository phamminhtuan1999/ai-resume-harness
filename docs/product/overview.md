# ApplyWise Product Overview

## Product Summary

ApplyWise is an AI-powered career copilot for software engineers in the US job
market who want to apply for AI Engineer, Applied AI Engineer, LLM Engineer,
GenAI Engineer, or closely related AI-focused engineering roles.

The MVP helps a user:

- Sign in and manage a private workspace.
- Create a career profile.
- Add resume content as Markdown or plain text.
- Paste a job description manually.
- Add a job by URL when the page is fetchable by an approved provider.
- Generate a candidate profile draft from extracted resume text.
- Analyze resume-to-job fit.
- See missing skills, weak positioning, strengths, and risks.
- Generate evidence-based resume suggestions with Truth Guard.
- Generate a 4-week skill and project roadmap.
- Generate interview preparation suggestions.
- Save jobs, recruiter/contact details, and tracker status.
- View a pricing page placeholder without processing payment.

## Target User

ApplyWise is built for software engineers with roughly 2-6 years of experience
who are transitioning from backend, full-stack, frontend, QA automation, cloud,
or enterprise software roles toward AI-focused engineering roles.

The MVP is not targeted at:

- Non-technical roles.
- General resume use cases.
- Immigrant-specific career guidance.
- Auto-application automation.
- Unauthorized LinkedIn scraping or login-gated job board automation.
- Recruiter-side hiring tools.

## Positioning

ApplyWise does not simply rewrite resumes. It explains what is missing, what can
be improved honestly, and what the candidate should build or learn before
applying.

The product should repeatedly answer this user question:

> Apply now or improve first?

## MVP Modules

| Module | Responsibility |
| --- | --- |
| Auth & Account | Clerk authentication, protected workspace access, account shell. |
| Resume Workspace | Resume text storage, primary resume summary, parse status. |
| Job Workspace | Manual job description storage, job URL intake, metadata, contact info, parse status. |
| AI Analysis Engine | Resume parsing, JD parsing, scoring, gaps, suggestions, roadmap, interview prep. |
| Application Tracker | Application status, job link, match link, notes, contacts. |
| Billing Placeholder | Pricing and plan positioning only; no payment processing in MVP. |

## Public And Protected Surfaces

Public pages:

- `/`
- `/pricing`
- `/sign-in`
- `/sign-up`

Protected pages:

- `/dashboard`
- `/profile`
- `/resumes`
- `/resumes/new`
- `/resumes/:id`
- `/jobs`
- `/jobs/new`
- `/jobs/:id`
- `/matches/:id`
- `/matches/:id/resume-suggestions`
- `/matches/:id/roadmap`
- `/matches/:id/interview-prep`
- `/tracker`
- `/settings`

## Navigation

The authenticated app shell uses a sidebar with:

- Dashboard
- Resumes
- Jobs
- Tracker
- Pricing
- Settings

The primary workflow CTA is:

- Analyze New Job
