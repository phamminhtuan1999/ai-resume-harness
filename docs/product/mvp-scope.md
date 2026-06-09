# ApplyWise MVP Scope

## In Scope

The MVP is complete when a user can:

1. Sign up and log in.
2. Create a career profile.
3. Add or import resume content from PDF, DOCX, image, Markdown, or plain text.
4. Add a job description manually.
5. Save job contact information.
6. Parse a resume into structured data.
7. Parse a job description into structured requirements.
8. Generate a match score.
9. View strengths and missing skills.
10. Generate safe resume suggestions.
11. Generate a Markdown tailored resume draft.
12. Generate a 4-week roadmap.
13. Generate interview prep suggestions.
14. Save a job to the application tracker.
15. View a pricing screen.
16. Add a job by URL using an approved fetch provider with manual paste
    fallback.
17. Generate a reviewed candidate profile draft from extracted resume text.

## Out Of Scope For MVP

- PDF or DOCX resume export.
- Section-by-section resume editor.
- Resume version comparison.
- Real Stripe or payment processing.
- Chrome extension.
- Browserbase-powered agentic job board navigation.
- GitHub project analyzer.
- AI mock interview chat.
- Advanced model selector.
- Application analytics.
- Voice interview.
- Auto job recommendations.
- Unauthorized LinkedIn scraping as a primary product dependency.
- Apify or job feed based automatic discovery.
- Public portfolio generator.
- Recruiter outreach generator.
- Team or career-coach dashboard.

## MVP Periods

| Period | Goal | Story Range |
| --- | --- | --- |
| Period 1 | Foundation, auth, profile, resume import, manual JD input, contact capture. | US-001 through US-006 |
| Period 2 | AI parsing, match scoring, missing skills, AI readiness. | Future story packets |
| Period 3 | Resume suggestions, Truth Guard, Markdown draft, roadmap, interview prep. | Future story packets |
| Period 4 | Tracker, pricing placeholder, landing page, settings, polish, demo flow. | Future story packets |
| Period 5 | UI/UX rework, validation consistency, responsive workflow polish, copy cleanup, and visual QA. | Future story packets |
| Period 6 | Job URL intake and resume-based profile autofill. | Future story packets |
| Period 7 | Commercial-grade design-system overhaul: brand, tokens, typography, primitives, app shell, landing, light/dark parity. | US-021 through US-026 |
| Period 8 | AI assistant intelligence overhaul: replace deterministic analysis with real AI (Gemini + fallback) on a shared backend workflow foundation; add cover letter, insight card, dashboard summary, AI activity feed, and workflow panel. | US-027 through US-038 |

## Period 1 Exit Criteria

Period 1 is complete when:

- User can sign up and log in through Clerk.
- User can create a career profile.
- User can add or import resume content from PDF, DOCX, image, Markdown, or
  plain text.
- User can add a job description manually.
- User can save contact info on a job.
- Dashboard shows basic empty and full states.

## Pricing Placeholder

The MVP includes `/pricing` with Free and Pro plan positioning. Upgrade buttons
must communicate `Coming soon` and must not initiate checkout or collect
payment details.

## UI Quality Exit Criteria

Before MVP release, Period 5 must complete the UI, UX, and validation quality
contract in `docs/product/ui-ux-quality.md`.
