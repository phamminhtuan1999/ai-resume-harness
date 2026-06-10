# Period 10 Brief — Rework Draft CV Export Formatting, Page Length, and Font Mapping

Verbatim user requirement (2026-06-09). This document is input material for
traceability; the accepted direction lives in
`docs/decisions/0014-draft-cv-rendering-rework.md` and the period README.

---

# Enhancement Task: Rework Draft CV Export Formatting, Page Length, and Font Mapping

## Context

The Draft CV feature has already been developed based on the previous requirement:

- Generate a job-specific recommended CV after resume analysis and job analysis
- Cross-reference current CV with job description
- Apply keyword extraction and alignment
- Rewrite bullets using the XYZ rule
- Preserve real metrics
- Export recommended CV as PDF/DOCX

However, the current implementation needs to be reworked to improve resume rendering quality, export consistency, page length decision logic, and font handling.

This is not a new feature. This is an enhancement/rework task for the existing Draft CV feature.

---

## Goal

Update the existing Draft CV generation and export flow so that:

1. The AI determines the recommended resume page count based on candidate years of experience, seniority, target job, and amount of relevant content.
2. The PDF/DOCX export uses an ApplyWise-controlled LaTeX-style font mapping system.
3. The renderer follows consistent resume layout rules instead of using arbitrary fonts or uncontrolled formatting.
4. The generated CV remains ATS-friendly, text-based, concise, and professional.
5. The user can export a high-quality PDF/DOCX resume suitable for applying to the analyzed job.

---

# Required Rework Areas

## 1. Add Resume Page Count Decision Logic

Before rendering/exporting the CV, the system must determine the recommended resume length.

The decision should be based on:

- Candidate years of experience
- Seniority level
- Target job seniority
- Amount of relevant experience
- Amount of relevant projects
- Whether critical job-aligned evidence would be lost by forcing one page

## Page Count Rules

Use the following rules:

```text
0–2 years experience: Target 1 page.

3–7 years experience: Prefer 1 page. Allow 2 pages only if there is highly
relevant experience, strong technical depth, or important projects that should
not be removed.

8–12 years experience: 1–2 pages allowed. Prefer 2 pages for senior/staff-level
roles or when leadership/project depth matters.

12+ years experience: 2 pages allowed. 3 pages only for exceptional cases such
as principal/staff leadership, patents, publications, research, or highly
specialized technical roles.
```

For ApplyWise's main target user — software engineers applying to AI/software engineering roles — default behavior should be:

```text
Default target: 1 page.
Allow 2 pages if years_of_experience >= 5 or if important job-relevant evidence
cannot fit cleanly on 1 page.
```

---

## 2. Add AI Rendering Recommendation Output

The Draft CV AI output must include a rendering recommendation object.

Add this object to the existing Draft CV JSON output:

```json
{
  "rendering_recommendation": {
    "recommended_page_count": 1,
    "page_count_reason": "The candidate has 4 years of experience and is applying to a mid-level role, so a concise one-page resume is recommended.",
    "font_profile": "modern_latex",
    "layout_density": "compact",
    "compression_strategy": [
      "Prioritize job-aligned backend and AI-related experience",
      "Condense older or less relevant bullets",
      "Limit projects to the most relevant items",
      "Preserve real metrics and critical technical evidence"
    ]
  }
}
```

Allowed values:

```text
recommended_page_count: 1 | 2 | 3

font_profile: modern_latex | ats_clean | classic_latex

layout_density: compact | standard | spacious
```

---

## 3. Add LaTeX-Style Font Mapping

The export renderer must not use random fonts.

Create a controlled ApplyWise font mapping system inspired by LaTeX resume formatting.

## Font Profiles

### modern_latex

Default profile.

```json
{
  "font_profile": "modern_latex",
  "latex_reference": "Latin Modern / Computer Modern style",
  "pdf_font": "Latin Modern Roman",
  "html_fallback": "Times New Roman, serif",
  "docx_font": "Latin Modern Roman",
  "docx_fallback": "Times New Roman",
  "use_case": "Default professional software engineering resume"
}
```

### ats_clean

ATS-safe corporate profile.

```json
{
  "font_profile": "ats_clean",
  "latex_reference": "Helvetica-style sans serif",
  "pdf_font": "Arial",
  "html_fallback": "Arial, Helvetica, sans-serif",
  "docx_font": "Arial",
  "docx_fallback": "Calibri",
  "use_case": "ATS-friendly corporate resume"
}
```

### classic_latex

Academic/research-heavy profile.

```json
{
  "font_profile": "classic_latex",
  "latex_reference": "Computer Modern style",
  "pdf_font": "Computer Modern Unicode",
  "html_fallback": "Times New Roman, serif",
  "docx_font": "Times New Roman",
  "docx_fallback": "Times New Roman",
  "use_case": "Research-heavy AI/ML or academic-style resume"
}
```

## Default Behavior

Use:

```text
Default font profile: modern_latex
Fallback font: Times New Roman
DOCX fallback: Times New Roman
```

If the selected font is unavailable, the renderer must fall back safely without breaking the export.

---

## 4. Update PDF Rendering Rules

The PDF export should be generated from structured CV JSON using the ApplyWise standard resume template.

The renderer must respect:

- Recommended page count
- Selected font profile
- Layout density
- ATS-friendly formatting
- Concise bullet length
- No tables/charts/progress bars

## Suggested PDF Render Config

For 1-page resume:

```json
{
  "template": "applywise_standard",
  "font_profile": "modern_latex",
  "page_size": "letter",
  "margin": {
    "top": "0.45in",
    "bottom": "0.45in",
    "left": "0.55in",
    "right": "0.55in"
  },
  "font_size": {
    "name": "18px",
    "section_heading": "12px",
    "body": "10px",
    "metadata": "9px"
  },
  "line_height": 1.15,
  "max_pages": 1
}
```

For 2-page resume:

```json
{
  "template": "applywise_standard",
  "font_profile": "modern_latex",
  "page_size": "letter",
  "margin": {
    "top": "0.5in",
    "bottom": "0.5in",
    "left": "0.6in",
    "right": "0.6in"
  },
  "font_size": {
    "name": "18px",
    "section_heading": "12px",
    "body": "10px",
    "metadata": "9px"
  },
  "line_height": 1.18,
  "max_pages": 2,
  "allow_additional_experience_detail": true
}
```

---

## 5. Add Compression Strategy

If the generated CV exceeds the recommended page count, the system must apply a compression strategy before export.

Compression should happen in this order:

1. Remove or condense least relevant bullets.
2. Reduce older experience detail.
3. Limit projects to the most job-relevant projects.
4. Combine overlapping skills.
5. Shorten professional summary.
6. Reduce bullet wording while preserving meaning.
7. Preserve real metrics and critical job-aligned evidence.

The system must not remove:

- Job-critical skills supported by the candidate profile
- Real metrics
- Current/recent highly relevant experience
- Required evidence for the target job

---

## 6. Update DOCX Export Rules

DOCX export must use the same structured CV JSON as PDF export.

The DOCX generator must map font profiles to compatible DOCX fonts:

```text
modern_latex:
Primary: Latin Modern Roman
Fallback: Times New Roman

ats_clean:
Primary: Arial
Fallback: Calibri

classic_latex:
Primary: Times New Roman
Fallback: Times New Roman
```

DOCX output must preserve:

- Same section order
- Same bullet content
- Same Truth Guard filtering
- Same page count recommendation where possible
- Same ATS-friendly structure

---

## 7. Update Draft CV UI

On the Draft CV preview page or section, display:

- Recommended page count
- Reason for recommended page count
- Selected font profile
- Layout density
- Compression strategy if applied
- PDF export button
- DOCX export button
- User override option for 1-page or 2-page export, if supported

Example UI copy:

```text
Recommended format: 1 page · Modern LaTeX

ApplyWise recommends a one-page resume because this is a mid-level software
engineering application and your most relevant experience can fit cleanly on
one page. Older or less relevant details were compressed to prioritize
job-aligned backend and AI-related experience.
```

---

## 8. Updated Acceptance Criteria

### Page Count Recommendation

Given a Draft CV is generated
When the AI returns the CV JSON
Then the JSON must include rendering_recommendation.recommended_page_count.

Given the candidate has 0–2 years of experience
Then the system should recommend 1 page.

Given the candidate has 3–7 years of experience
Then the system should prefer 1 page and allow 2 pages only with justification.

Given the candidate has 8+ years of experience
Then the system may recommend 2 pages.

Given the candidate has 12+ years of experience
Then the system may allow 2 pages and only allow 3 pages for exceptional cases.

### Font Mapping

Given the user exports a PDF
Then the renderer must use the selected ApplyWise font profile.

Given the selected font is unavailable
Then the renderer must use the configured fallback font.

Given the user exports DOCX
Then the DOCX generator must map the font profile to the correct DOCX font.

### Layout Consistency

Given the CV is exported
Then the output must use the ApplyWise standard resume template.

Given the CV is exported
Then it must not use markdown tables, charts, progress bars, or icons that may break ATS parsing.

Given bullet points are rendered
Then they should remain concise and avoid exceeding 2 printed lines when possible.

### Compression

Given the generated CV exceeds the recommended page count
Then the system must apply a compression strategy before export.

Given compression is applied
Then the system must preserve job-critical experience, real metrics, and supported keywords.

### User Override

Given the system recommends 1 page
When the user chooses 2-page export
Then the renderer should allow it if supported.

Given the system recommends 2 pages
When the user chooses 1-page export
Then the system should warn that some detail may be compressed.

---

## 9. Implementation Notes

This should be implemented as an enhancement to the existing Draft CV flow.

Do not rebuild the entire Draft CV feature.

Update the existing flow in these places:

1. Draft CV AI generation schema
2. Draft CV renderer config
3. PDF export service
4. DOCX export service
5. Draft CV preview UI
6. Validation schema
7. Export acceptance checks

Use the existing AI model integration and existing CV generation pipeline.

---

## 10. Definition of Done

This rework is complete when:

- Draft CV AI output includes rendering recommendation.
- Recommended page count is based on years of experience and seniority.
- PDF export uses ApplyWise font profile mapping.
- DOCX export uses compatible font mapping.
- Default font profile is modern_latex.
- Renderer falls back safely if selected font is unavailable.
- User can see page count reasoning in the UI.
- Exported PDF/DOCX uses the ApplyWise standard resume template.
- CV remains ATS-friendly and text-based.
- Compression logic prevents unnecessary page overflow.
- Existing Draft CV generation still follows keyword alignment, XYZ rule, metrics preservation, and Truth Guard.
