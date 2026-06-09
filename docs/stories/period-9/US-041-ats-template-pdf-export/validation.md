# Validation

## Proof Strategy

The export is a security boundary: the highest-value proof is **content
assertion on the produced PDF** — extract text (pypdf, test-only dependency)
and assert inclusion/exclusion against a golden fixture `cv_json` containing
all three truth-guard states and both `user_action` values. Serializer rules
are pure-function unit tests. Endpoint, status, activity, and redaction at
integration level. A human visual check of one rendered PDF against the
template contract is required evidence (layout cannot be asserted by text
extraction).

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Serializer: `safe_to_use` included; approved `needs_confirmation` included; pending/rejected `needs_confirmation` excluded; `do_not_use_yet` excluded; empty sections omitted; all-bullets-filtered entry renders header-only; section order fixed; `empty_cv` predicate (no bullets + no summary); escaping of `<`, `&`, unicode names; export-notes computation (included keywords, pending texts, metrics preserved). Filename slugging: unicode → ASCII, no path separators. |
| Integration | POST export/pdf on golden fixture → 200, `application/pdf` magic bytes, attachment header; **extracted PDF text contains** approved + safe bullet text **and does not contain** any `do_not_use_yet` or pending/rejected text, in original or demoted form; `last_exported_pdf_at` set; status → `exported`; `draft_cv.exported` activity row; `empty_cv` → 422, no mutation; ownership denial → no render; render exception → 500 `render_failure`, no status/timestamp mutation; export-preview endpoint returns pending count + notes without side effects. |
| E2E | Review page: pending items → Export PDF shows warn dialog with count → confirm → file downloads → status chip flips to `exported` (browser E2E; tracked with the suite-wide gap if not run). |
| Platform | Rendered PDF opens in macOS Preview + one ATS-parse sanity check (copy-paste text out of the PDF preserves reading order, single column). Desktop + mobile screenshots of the export dialog states. |
| Performance | Render p95 under ~3s for a 2-page fixture on dev hardware (no network fetches during render — assert no webfont/HTTP access). |
| Logs/Audit | Export logs contain draft id/format/latency only — no candidate name, bullet text, or filename; activity feed shows the export event with related match/job. |

## Fixtures

Golden `cv_json` fixture: 2 experience entries (5 bullets covering all
truth-guard × user_action combinations, one bullet with "38%" + "$1.2M"
metrics), 1 project, 2 skill categories + 1 empty category, education,
certifications, unicode candidate name ("Đặng Quốc Tuấn") for slug/escape
coverage; a second all-excluded fixture for `empty_cv`.

## Commands

```text
cd apps/api && pytest tests/test_draft_cv_export_pdf.py -q
cd apps/api && pytest -q
scripts/bin/harness-cli story verify US-041   # after --verify is configured
```

## Acceptance Evidence

Add pytest output, one attached rendered golden PDF (or screenshot), the
copy-paste ATS sanity result, and the redacted-log capture after
verification.
