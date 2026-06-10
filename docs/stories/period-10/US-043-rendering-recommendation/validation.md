# Validation

## Proof Strategy

Pure-function unit proof for the policy (band matrix, boundary years, proxies,
parse fallback, determinism) + workflow-level integration proof with the
deterministic provider fixtures from `tests/ai_fakes.py` (no live Gemini).
Record proof with `scripts/bin/harness-cli story update --id US-043 --unit 1
--integration 1 --e2e 0 --platform 0` only after the listed cases pass.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Band matrix incl. boundaries: yoe 0, 2, 2.9 → 1/1; 3, 4.9 → 1/1 without trigger, 1/2 with; 5, 7.9 → 1/2; 8, 11.9 → 1/2 plain, 2/2 with seniority signal or trigger; 12, 20 → 2/2 plain, 2/3 with exceptional gate. Unknown yoe → 1/2 + `yoe_unknown`. Span-parse fallback: "Oct 2022"–"Present" + "2019"–"2021" → max−min years, source `parsed_work_history`; unparseable strings → unknown. Evidence trigger: ≥18 profile bullets or ≥4 work entries. Seniority keywords (job + candidate titles). Exceptional gate only at 12+ (gate signals at 8 y must NOT yield 3). Clamp: model 3 vs max 2 → 2 + `policy_clamped`; model within range → untouched, no note. Same inputs → same policy (determinism, injected now). |
| Integration | Generate (fake Gemini): draft row has `rendering_json` with clamped `recommendation`, `page_policy` snapshot, `model_recommendation` pre-clamp values; quality notes include `policy_clamped` when moved. Fallback (keyless): recommendation = policy target, templated reason, `modern_latex`, schema-valid. Prompt: `build_prompt` output contains the policy target/max line. Reads: GET latest + GET by id return `rendering_json`; version list unchanged. Legacy row (null `rendering_json`) read returns null without error. Migration `0019` applies on a fresh DB and is additive (existing rows keep working). |
| E2E | Deferred to US-046 (UI story) + suite-wide browser gap. |
| Platform | n/a |
| Logs/Audit | Run log line for a generation contains no resume/JD/CV text (existing redaction assertion pattern extended to the new prompt section). |

## Fixtures

- Profile rows with `years_of_experience` ∈ {None, 1, 4, 6, 9, 13} and
  `candidate_profile_json` variants: small (3 bullets), voluminous (20+
  bullets / 4 entries), publication marker ("publications": […]), free-form
  date strings for the parse fallback.
- Job rows: plain title ("Software Engineer") and senior title ("Staff
  Engineer, Platform"), with/without `structured_json` seniority hints.
- Fake provider outputs: recommendation in range; recommendation 3 with low
  yoe (clamp path); missing `rendering_recommendation` key (schema default).

## Commands

```text
cd apps/api && .venv/bin/python -m pytest tests/test_page_policy.py -q
cd apps/api && .venv/bin/python -m pytest tests/test_draft_cv_workflow.py -q
cd apps/api && .venv/bin/python -m pytest -q   # full suite stays green
```

## Acceptance Evidence

Add pytest output and the migration apply log after verification.
