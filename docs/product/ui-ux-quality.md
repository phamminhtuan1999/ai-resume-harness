# UI, UX, And Validation Quality

## Design Read

ApplyWise is a B2B SaaS-style product workspace for job seekers making repeated,
high-stakes decisions. The UI should feel quiet, trustworthy, and task-focused:
dense enough for comparison and review, but not decorative or marketing-heavy.

Design dials for the next UI rework:

- Design variance: 4. Preserve the existing product structure and improve
  consistency before introducing new visual language.
- Motion intensity: 2. Use motion only for feedback, loading, and state changes.
- Visual density: 6. Protected workspace pages should support scanning,
  comparison, and repeated use.

## Quality Contract

All product surfaces must follow these rules:

- Use one theme and one accent language across public and protected pages.
- Keep the current restrained SaaS palette unless a later brand decision changes
  it.
- Keep one corner-radius system for cards, buttons, inputs, alerts, and popups.
- Keep page headings, section headings, and compact panel headings on distinct
  type scales.
- Avoid visible instructional copy that describes the UI itself.
- Re-read every visible string before release and fix typos, grammar issues,
  inconsistent capitalization, and unclear labels.
- Use icons only where they make repeated actions easier to scan.
- Do not hide required workflow steps inside decorative cards or generic
  placeholders.

## Form Contract

All create/update forms must provide:

- Visible labels above inputs. Placeholders may provide examples but must not be
  the only label.
- Required fields marked consistently in label or helper text.
- Client constraints for required values, URL, email, length, file type, and file
  size where applicable.
- Server validation for the same constraints.
- Field-level error rendering for validation errors that map to one field.
- A form-level alert for cross-field or persistence errors.
- Success feedback through the shared alert/popup pattern.
- Create flows that return to the list or destination view after the user has
  seen success feedback.
- Disabled and pending states that prevent duplicate submissions.

## State Contract

Every major page must intentionally handle:

- Loading states shaped like the final layout, not generic spinners.
- Empty states with a direct next action.
- Error states with a recovery action or clear next step.
- Success states that confirm what changed.
- Mobile and desktop responsive layouts with no text overlap, button wrapping,
  or horizontal overflow.

## Validation Proof

UI and validation stories must include proof from:

- Unit tests for validation helpers and field error mapping.
- Integration tests for server action validation and redirects.
- Browser verification for the primary create/update flows.
- Desktop and mobile screenshots for the changed surfaces.
- Console/log inspection for client errors during the verified flows.
