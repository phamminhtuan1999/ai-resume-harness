# Design

## Domain Model

- **MatchAnalysis** — the AI evaluation of one `matches` row. Extends the
  existing match record with assistant summary, fit reasoning, apply
  recommendation, evidence-linked strengths, classified gaps, per-score
  explanations, risks, next best action, and confidence.
- **Strength** — `{ strength, resume_evidence, job_requirement, why_it_matters }`.
  A strength with no `resume_evidence` is dropped (Story 1.2 rule).
- **Gap** — `{ gap, gap_type (true_gap|wording_gap|proof_gap), job_requirement,
  why_it_matters, suggested_action }`. Inline summary; the full grouped gap
  breakdown is US-029.

## Application Flow

`MatchAnalysisWorkflow.run(match_id, user_id, regenerate)`:

1. US-027 authorize + `ai_workflow_runs` (queued→running).
2. `load_input()`: candidate profile + resume text + parsed resume + job
   requirements + raw JD + user preferences (target roles/locations, work-type,
   seniority).
3. Provider generate → validate against `MatchAnalysisOutput`.
4. Reconcile scores: recompute `overall_score = skill*0.30 + experience*0.20 +
   ai_readiness*0.25 + ats_keyword*0.15 + seniority*0.10`; attach label.
5. `persist()` via `save_match_analysis()`.
6. US-027 update run + write `activity_feed` (importance from score band).
7. Return standard envelope with the MatchAnalysis result.

Regenerate runs the same flow with `regenerate=True`, creating a new run and
overwriting the saved analysis (prior run rows are retained for history).

## Interface Contract

```http
POST /api/matches/{matchId}/analyze
POST /api/matches/{matchId}/analyze/regenerate
GET  /api/matches/{matchId}/match-analysis
```

Response uses the US-027 envelope; `result` is the Feature 1.4 schema:

```json
{
  "overall_score": 0, "skill_score": 0, "experience_score": 0,
  "ai_readiness_score": 0, "ats_keyword_score": 0, "seniority_score": 0,
  "location_score": 0, "seniority_match_label": "string",
  "apply_recommendation": "apply_now|apply_with_improvements|improve_first|not_recommended",
  "assistant_summary": "string", "fit_reasoning": "string",
  "score_explanations": { "skill": "string", "experience": "string", "ai_readiness": "string", "ats_keyword": "string", "seniority": "string" },
  "top_strengths": [ { "strength": "string", "resume_evidence": "string", "job_requirement": "string", "why_it_matters": "string" } ],
  "top_gaps": [ { "gap": "string", "gap_type": "true_gap|wording_gap|proof_gap", "job_requirement": "string", "why_it_matters": "string", "suggested_action": "string" } ],
  "risks": ["string"], "next_best_action": "string", "confidence_score": 0.0
}
```

Errors: US-027 taxonomy. `missing_profile` and `missing_job_requirements` are
the most likely pre-flight failures and must return a friendly, actionable
message ("Add your candidate profile first" / "This job has not been parsed").

## Data Model

Migration `0011_period8_match_analysis_ai.sql` — additive columns on `matches`:

- `apply_recommendation text`
- `assistant_summary text`
- `fit_reasoning text`
- `score_explanations_json jsonb`
- `top_strengths_json jsonb`
- `top_gaps_json jsonb`
- `next_best_action text`
- `confidence_score numeric`
- `analyzer_provider text`   — `gemini | deterministic`

Existing `overall_score`, sub-scores, `strengths_json`, `weaknesses_json`,
`missing_skills_json`, `risks_json`, `explanation_json` are preserved
(`strengths_json`/`missing_skills_json` may mirror the structured arrays for
backward compatibility with existing readers).

## UI / Platform Impact

`/matches/[matchId]` upgraded to the brief's Feature 1.7 sections: AI Job
Assistant Summary, Apply Recommendation badge, Score Breakdown (each score +
explanation), Why You Match (evidence), What Is Missing (inline gaps), Resume
Wording Gaps, Risks, Next Best Action, Regenerate Analysis. Loading/failed
states per US-027 error contract.

## Observability

Inherits US-027: one redacted log line per run; `ai_workflow_runs` records
provider, latency, confidence; `activity_feed` event ("ApplyWise scored the
{role} role at {overall}% — {recommendation}.").

## Alternatives Considered

1. Trust the model's `overall_score` directly. Rejected — the accepted weighting
   must hold; recompute server-side and treat the model's overall as advisory.
2. New `match_analyses` table instead of extending `matches`. Rejected for MVP —
   one analysis per match; additive columns keep existing readers working.
