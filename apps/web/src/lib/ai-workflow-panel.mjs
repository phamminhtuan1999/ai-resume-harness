/*
  Step manifest + view logic for the US-038 AI Workflow Panel.

  Ten steps in order. Steps 1-3 are pre-match (owned by the resume/job import
  flows) and have no ai_workflow_runs rows — their status is derived from the
  profile/job parse state. Steps 4-10 read the latest ai_workflow_runs row per
  workflow_type; a failed run with error_code "blocked_by_dependency" renders
  as "Skipped". All status indicators are run-driven — no static badges.
*/

export const BLOCKED_ERROR_CODE = "blocked_by_dependency";

export const STEP_MANIFEST = [
  {
    workflow_type: "resume_profile_extraction",
    name: "Resume Profile Extraction",
    prematch: true,
    description: "Extract a structured candidate profile from your resume.",
  },
  {
    workflow_type: "job_import",
    name: "Job Import",
    prematch: true,
    description: "Import the job description from a URL or pasted text.",
  },
  {
    workflow_type: "job_requirement_extraction",
    name: "Job Requirement Extraction",
    prematch: true,
    description: "Extract structured requirements from the job description.",
  },
  {
    workflow_type: "match_analysis",
    name: "AI Match Analysis",
    description: "Score how well your resume fits this job, with evidence.",
    href: "",
  },
  {
    workflow_type: "missing_skills",
    name: "Missing Skill Analysis",
    description: "Classify every skill gap by importance and how to fix it.",
    href: "gaps",
  },
  {
    workflow_type: "resume_suggestions",
    name: "Tailored Resume",
    description: "Generate truth-guarded resume suggestions for this role.",
    href: "resume-suggestions",
  },
  {
    workflow_type: "cover_letter",
    name: "Cover Letter",
    description: "Generate a personalized cover letter that positions your real experience for this role.",
    href: "cover-letter",
  },
  {
    workflow_type: "roadmap",
    name: "4-Week Roadmap",
    description: "Build a 4-week improvement plan that closes your critical gaps.",
    href: "roadmap",
  },
  {
    workflow_type: "interview_prep",
    name: "Interview Prep",
    description: "Generate job-specific interview questions and honest answer guidance.",
    href: "interview-prep",
  },
  {
    workflow_type: "assistant_insight",
    name: "Job Assistant Insight",
    description: "Summarize whether to apply now and what to do first.",
    href: "",
  },
];

const STATUS_META = {
  not_started: { label: "Not started", variant: "outline" },
  running: { label: "Running…", variant: "secondary" },
  completed: { label: "Completed", variant: "success" },
  needs_review: { label: "Needs review", variant: "warning" },
  failed: { label: "Failed", variant: "destructive" },
  blocked: { label: "Skipped", variant: "outline" },
};

export function stepStatusMeta(status) {
  return STATUS_META[status] ?? STATUS_META.not_started;
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

export function deriveStepSummary(workflowType, snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : {};

  switch (workflowType) {
    case "match_analysis": {
      if (data.assistant_summary) {
        return String(data.assistant_summary);
      }
      const score = Number(data.overall_score);
      return Number.isFinite(score)
        ? `Overall match is ${score}%.`
        : "Match analysis saved.";
    }
    case "missing_skills": {
      const gaps = count(data.missing_skills);
      const top = Array.isArray(data.top_3_priority_gaps)
        ? data.top_3_priority_gaps[0]
        : null;
      return `${gaps} skill gap(s) identified.${top ? ` Top gap: ${top}.` : ""}`;
    }
    case "resume_suggestions": {
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      const safe = suggestions.filter((s) => s?.truth_guard_status === "safe_to_use").length;
      const confirm = suggestions.filter(
        (s) => s?.truth_guard_status === "needs_confirmation"
      ).length;
      const avoid = suggestions.filter(
        (s) => s?.truth_guard_status === "do_not_use_yet"
      ).length;
      return `${suggestions.length} suggestion(s): ${safe} safe to use, ${confirm} need confirmation, ${avoid} should not be used yet.`;
    }
    case "cover_letter": {
      const words = String(data.cover_letter ?? "")
        .split(/\s+/)
        .filter(Boolean).length;
      return words > 0
        ? `${words}-word cover letter generated.`
        : "Cover letter generated.";
    }
    case "roadmap": {
      const weeks = count(data.weeks);
      const items = Array.isArray(data.weeks)
        ? data.weeks.reduce((total, week) => total + count(week?.tasks), 0)
        : 0;
      return `${weeks}-week roadmap generated with ${items} task(s).`;
    }
    case "interview_prep": {
      const questions =
        count(data.technical_questions) +
        count(data.ai_llm_questions) +
        count(data.system_design_questions) +
        count(data.behavioral_questions);
      return `${questions} interview question(s) generated with ${count(
        data.weak_topics_to_study
      )} weak topic(s) to study.`;
    }
    case "assistant_insight":
      return String(data.assistant_summary || "Assistant insight generated.");
    case "resume_profile_extraction":
      return "Candidate profile extracted from your resume.";
    case "job_import":
      return "Job description imported.";
    case "job_requirement_extraction":
      return "Structured requirements extracted from the job description.";
    default:
      return "Step completed.";
  }
}

function section(label, value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return items.length > 0 ? { label, items } : null;
  }
  const text = String(value ?? "").trim();
  return text ? { label, text } : null;
}

/*
  Friendly inline rendering of a step's output_snapshot_json (US-038 "View
  output" expands in place instead of forcing a page navigation). Returns
  ordered sections: { label, text? } for prose, { label, items? } for lists.
*/
export function stepOutputDetails(workflowType, snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : {};

  switch (workflowType) {
    case "match_analysis":
      return [
        section("Recommendation", data.apply_recommendation?.replaceAll?.("_", " ")),
        section("Summary", data.assistant_summary),
        section("Fit reasoning", data.fit_reasoning),
        section(
          "Top strengths",
          (data.top_strengths ?? []).map((item) => item?.strength)
        ),
        section(
          "Top gaps",
          (data.top_gaps ?? []).map((item) => item?.gap)
        ),
        section("Next best action", data.next_best_action),
      ].filter(Boolean);
    case "missing_skills":
      return [
        section("Summary", data.summary),
        section(
          "Missing skills",
          (data.missing_skills ?? []).map((item) =>
            item?.skill ? `${item.skill} (${item.importance ?? "medium"})` : null
          )
        ),
        section("Top priorities", data.top_3_priority_gaps),
      ].filter(Boolean);
    case "resume_suggestions":
      return [
        section("Strategy", data.resume_strategy),
        section("Summary", data.assistant_summary),
        section(
          "Suggestions",
          (data.suggestions ?? []).map((item) =>
            item?.suggested_text
              ? `${item.suggested_text} [${(item.truth_guard_status ?? "").replaceAll("_", " ")}]`
              : null
          )
        ),
        section("Do not claim", data.do_not_claim),
      ].filter(Boolean);
    case "cover_letter":
      return [
        section("Cover letter", data.cover_letter),
        section("Strategy", data.cover_letter_strategy),
        section("Key points used", data.key_points_used),
        section("Claims avoided", data.claims_avoided),
      ].filter(Boolean);
    case "roadmap":
      return [
        section("Summary", data.roadmap_summary),
        section("Project theme", data.recommended_project_theme),
        section(
          "Weeks",
          (data.weeks ?? []).map((week) =>
            week?.goal ? `Week ${week.week}: ${week.goal}` : null
          )
        ),
        section("Success criteria", data.success_criteria),
      ].filter(Boolean);
    case "interview_prep":
      return [
        section("Prep summary", data.prep_summary),
        section("Technical", data.technical_questions),
        section("AI / LLM", data.ai_llm_questions),
        section("System design", data.system_design_questions),
        section("Behavioral", data.behavioral_questions),
        section("Weak topics to study", data.weak_topics_to_study),
      ].filter(Boolean);
    case "assistant_insight":
      return [
        section("Summary", data.assistant_summary),
        section("Recommendation", data.recommendation?.replaceAll?.("_", " ")),
        section("Why", data.why_this_recommendation),
        section("Next best action", data.next_best_action),
        section("Application strategy", data.application_strategy),
      ].filter(Boolean);
    default:
      return [];
  }
}

function runStatus(run) {
  if (!run) {
    return "not_started";
  }
  if (run.error_code === BLOCKED_ERROR_CODE) {
    return "blocked";
  }
  if (run.status === "queued" || run.status === "running") {
    return "running";
  }
  if (["completed", "needs_review", "failed"].includes(run.status)) {
    return run.status;
  }
  return "not_started";
}

export function buildPanelRows({ runs, profileReady, jobImported, jobParsed }) {
  const latestByType = {};
  for (const run of Array.isArray(runs) ? runs : []) {
    if (run?.workflow_type && !(run.workflow_type in latestByType)) {
      latestByType[run.workflow_type] = run;
    }
  }

  const prematchState = {
    resume_profile_extraction: profileReady,
    job_import: jobImported,
    job_parsed: jobParsed,
  };

  return STEP_MANIFEST.map((step) => {
    if (step.prematch) {
      const ready =
        step.workflow_type === "job_requirement_extraction"
          ? Boolean(jobParsed)
          : Boolean(prematchState[step.workflow_type]);
      const status = ready ? "completed" : "not_started";
      return {
        ...step,
        status,
        summary: ready ? deriveStepSummary(step.workflow_type, null) : step.description,
        model_name: null,
        confidence_score: null,
        completed_at: null,
        error_message: null,
        can_act: false,
      };
    }

    const run = latestByType[step.workflow_type] ?? null;
    const status = runStatus(run);
    let summary = step.description;
    if (status === "completed" || status === "needs_review") {
      summary = deriveStepSummary(step.workflow_type, run?.output_snapshot_json);
    } else if (status === "failed") {
      summary = run?.error_message || "This step failed. Retry to continue.";
    } else if (status === "blocked") {
      summary = "Skipped — a previous step failed.";
    }

    return {
      ...step,
      status,
      summary,
      model_name: run?.model_name ?? null,
      confidence_score:
        typeof run?.confidence_score === "number" ? run.confidence_score : null,
      completed_at: run?.completed_at ?? null,
      error_message: run?.error_message ?? null,
      snapshot: run?.output_snapshot_json ?? null,
      can_act: true,
    };
  });
}

export function anyStepRunning(rows) {
  return (Array.isArray(rows) ? rows : []).some((row) => row.status === "running");
}

export function panelProgress(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const completed = list.filter(
    (row) => row.status === "completed" || row.status === "needs_review"
  ).length;
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function remainingActionableSteps(rows) {
  // Steps run-full would still execute: orchestrated (non-prematch) steps that
  // are not already completed / under review. Completed steps are never re-run.
  return (Array.isArray(rows) ? rows : []).filter(
    (row) =>
      !row.prematch && row.status !== "completed" && row.status !== "needs_review"
  ).length;
}
