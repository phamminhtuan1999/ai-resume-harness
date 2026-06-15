# Job `source` Taxonomy Reconciliation

Date: 2026-06-15

## Status

Accepted

## Context

`jobs.source` today is, from migration `0009_period6_job_url_intake.sql`:

```sql
add column if not exists source text not null default 'manual'
  check (source in ('manual', 'manual_url'))
```

So existing rows are `'manual'` (pasted JD via `saveJobAction`) or `'manual_url'`
(URL import). The Period 16 intake spec (Epic 8) defines a three-value
taxonomy — `discovered_api`, `manual_url`, `manual_paste` — to record how a job
entered ApplyWise across the three intake modes. We need a canonical set and a
no-loss migration of existing rows.

## Decision

### Canonical set

| Value | Meaning | Producer |
| --- | --- | --- |
| `discovered_api` | Found via Search AI Jobs (external provider) | US-077 search Save |
| `manual_url` | Imported by URL | existing URL import + US-077 |
| `manual_paste` | Pasted job description | existing paste + US-077 |

`manual` is **retired** from the allowed set after backfill.

### Migration (additive, idempotent, next number 0030)

1. `update jobs set source = 'manual_paste' where source = 'manual';` — today
   `'manual'` means a pasted JD, so it maps cleanly with no data loss.
2. Drop and recreate the check constraint to
   `check (source in ('discovered_api', 'manual_url', 'manual_paste'))`.
3. Change the column default to `'manual_paste'` (the conservative default for a
   row created without an explicit source).

The migration is re-runnable: the `update` is a no-op once no `'manual'` rows
remain, and the constraint drop/recreate is guarded with
`drop constraint if exists`.

### Producer responsibility

Each intake path sets `source` explicitly at Save (US-077): search →
`discovered_api`, URL → `manual_url`, paste → `manual_paste`. No path relies on
the column default.

## Consequences

- Existing pasted jobs reclassify cleanly to `manual_paste`; URL jobs are
  unchanged; the constraint rejects any unknown source.
- Web/data readers that display or branch on `source` map the three canonical
  values (and may keep a legacy label for historic `manual` in read-only views
  if any cached copy lingers, though the DB will hold none).
- Applied to live Supabase via `psql "$SUPABASE_DB_URL"` per project
  convention, alongside the US-071 column additions.
