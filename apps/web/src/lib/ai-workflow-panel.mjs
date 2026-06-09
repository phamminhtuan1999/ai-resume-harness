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
    artifact: "skill gaps",
  },
  {
    workflow_type: "resume_suggestions",
    name: "Tailored Resume",
    description: "Generate truth-guarded resume suggestions for this role.",
    href: "resume-suggestions",
    artifact: "resume suggestions",
  },
  {
    workflow_type: "cover_letter",
    name: "Cover Letter",
    description: "Generate a personalized cover letter that positions your real experience for this role.",
    href: "cover-letter",
    artifact: "cover letter",
  },
  {
    workflow_type: "roadmap",
    name: "4-Week Roadmap",
    description: "Build a 4-week improvement plan that closes your critical gaps.",
    href: "roadmap",
    artifact: "4-week plan",
  },
  {
    workflow_type: "interview_prep",
    name: "Interview Prep",
    description: "Generate job-specific interview questions and honest answer guidance.",
    href: "interview-prep",
    artifact: "interview questions",
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

/*
  Inline step digest (US-038, surface revision 3).

  Revision 2 expanded the step's full report inline, which buried the stepper
  under walls of content. This revision is a deliberate digest: headline facts,
  ONE summary block, and a count-aware link to the workspace page where the
  full artifact (and its actions) live. Two steps return an empty digest on
  purpose — match_analysis and assistant_insight are rendered natively on the
  match page the panel sits on, so an expander would duplicate visible content.

    { facts:      [{ label, value, tone }],          — headline badge row
      blocks: [
        { kind: "prose",    label, text },
        { kind: "document", label, text },           — the deliverable itself
        { kind: "list",     label, items: [string] },
        { kind: "chips",    label, items: [{ label, tone }] },
      ],
      link_label: string | null }                    — workspace link text

  tone is "success" | "warning" | "destructive" | "neutral"; the renderer maps
  it onto badge variants.
*/

function humanize(value) {
  const text = String(value ?? "").replaceAll("_", " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function clean(value) {
  return String(value ?? "").trim();
}

function fact(label, value, tone = "neutral") {
  const text = clean(value);
  return text ? { label, value: text, tone } : null;
}

function prose(label, text) {
  const value = clean(text);
  return value ? { kind: "prose", label, text: value } : null;
}

function documentBlock(label, text) {
  const value = clean(text);
  return value ? { kind: "document", label, text: value } : null;
}

function listBlock(label, items) {
  const kept = (Array.isArray(items) ? items : [])
    .map((item) => clean(item))
    .filter(Boolean);
  return kept.length > 0 ? { kind: "list", label, items: kept } : null;
}

function chipsBlock(label, items) {
  const kept = (Array.isArray(items) ? items : [])
    .map((item) =>
      typeof item === "string"
        ? { label: clean(item), tone: "neutral" }
        : { label: clean(item?.label), tone: item?.tone ?? "neutral" }
    )
    .filter((item) => item.label);
  return kept.length > 0 ? { kind: "chips", label, items: kept } : null;
}

export function stepOutputView(workflowType, snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : {};
  const facts = [];
  const blocks = [];
  let linkLabel = null;

  switch (workflowType) {
    // match_analysis and assistant_insight: no digest — the match page renders
    // their full content (score breakdown, strengths/gaps, insight card).
    case "missing_skills": {
      const skills = Array.isArray(data.missing_skills) ? data.missing_skills : [];
      const byImportance = (importance) =>
        skills.filter((item) => item?.importance === importance).length;
      const critical = byImportance("critical");
      const medium = byImportance("medium");
      const nice = byImportance("nice_to_have");
      facts.push(
        critical > 0 ? fact("Critical", `${critical} critical`, "destructive") : null,
        medium > 0 ? fact("Medium", `${medium} medium`, "warning") : null,
        nice > 0 ? fact("Nice to have", `${nice} nice-to-have`) : null
      );
      blocks.push(
        prose("Summary", data.summary),
        chipsBlock(
          "Top priorities",
          (data.top_3_priority_gaps ?? []).map((item) => ({
            label: item,
            tone: "warning",
          }))
        )
      );
      linkLabel =
        skills.length > 0
          ? `Review all ${skills.length} gaps with how-to-fix guidance`
          : null;
      break;
    }

    case "resume_suggestions": {
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      const byStatus = (status) =>
        suggestions.filter((item) => item?.truth_guard_status === status).length;
      const safe = byStatus("safe_to_use");
      const confirm = byStatus("needs_confirmation");
      const avoid = byStatus("do_not_use_yet");
      facts.push(
        safe > 0 ? fact("Safe", `${safe} safe to use`, "success") : null,
        confirm > 0 ? fact("Confirm", `${confirm} need confirmation`, "warning") : null,
        avoid > 0 ? fact("Avoid", `${avoid} do not use yet`, "destructive") : null
      );
      blocks.push(prose("Strategy", data.resume_strategy));
      linkLabel =
        suggestions.length > 0
          ? `Review all ${suggestions.length} suggestions`
          : null;
      break;
    }

    case "cover_letter": {
      const words = clean(data.cover_letter).split(/\s+/).filter(Boolean).length;
      facts.push(
        words > 0 ? fact("Length", `${words} words`) : null,
        fact("Tone", data.tone ? `${humanize(data.tone)} tone` : "")
      );
      blocks.push(documentBlock("Cover letter", data.cover_letter));
      linkLabel = "Open the cover letter workspace";
      break;
    }

    case "roadmap": {
      const weeks = Array.isArray(data.weeks) ? data.weeks : [];
      const tasks = weeks.reduce((total, week) => total + count(week?.tasks), 0);
      facts.push(
        weeks.length > 0 ? fact("Weeks", `${weeks.length} weeks`) : null,
        tasks > 0 ? fact("Tasks", `${tasks} tasks`) : null
      );
      blocks.push(
        prose("Summary", data.roadmap_summary),
        listBlock(
          "Week goals",
          weeks.map((week) =>
            week?.goal ? `Week ${week.week ?? "?"} — ${clean(week.goal)}` : null
          )
        )
      );
      linkLabel = weeks.length > 0 ? "Open the full week-by-week plan" : null;
      break;
    }

    case "interview_prep": {
      const totalQuestions =
        count(data.technical_questions) +
        count(data.ai_llm_questions) +
        count(data.system_design_questions) +
        count(data.behavioral_questions);
      const weakTopics = count(data.weak_topics_to_study);
      facts.push(
        totalQuestions > 0 ? fact("Questions", `${totalQuestions} questions`) : null,
        weakTopics > 0
          ? fact("Weak topics", `${weakTopics} weak topics`, "warning")
          : null
      );
      blocks.push(
        prose("Prep summary", data.prep_summary),
        chipsBlock(
          "Weak topics to study",
          (data.weak_topics_to_study ?? []).map((item) => ({
            label: item,
            tone: "warning",
          }))
        )
      );
      linkLabel =
        totalQuestions > 0
          ? `Review all ${totalQuestions} questions with answer guidance`
          : null;
      break;
    }

    default:
      break;
  }

  return {
    facts: facts.filter(Boolean),
    blocks: blocks.filter(Boolean),
    link_label: linkLabel,
  };
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
