# Validation - US-082 Tracker Interview Scheduling Fields

## Proof Strategy

Prove that interview scheduling fields are additive, ownership-safe, and do not
change tracker status semantics.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Validation accepts empty fields, valid dates, supported stage values if constrained, and rejects invalid date payloads. Learning Target count rules ignore interview fields. |
| Integration | Migration applies cleanly; owned row can update interview fields; another user's row is denied without data leakage; status update still works; `applied_date` remains distinct. |
| E2E | Browser check on `/tracker`: add interview date/stage/notes, save, reload, verify persistence and unchanged status grouping. |
| Platform | Build/lint/test commands pass after migration and generated types are updated. |
| Performance | Calendar-ready query over `(user_id, interview_date)` remains bounded if an index is added. |
| Logs/Audit | Existing request logging remains canonical; activity event covered only if implemented. |

## Fixtures

- User A with tracker row in `applied`.
- User A with tracker row in `learning_target`.
- User B with a tracker row for ownership-denial proof.
- Row with null interview fields.
- Row with a future interview date.

## Commands

Add commands after scripts exist.

```text
TBD
```

## Acceptance Evidence

Add results after verification.

