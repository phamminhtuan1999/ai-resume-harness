// Pure view helpers for the Recommended Next Actions panel (US-049).
// Plain ESM so the server components and the node --test suite share one source.
// The placement, label, priority, and state are authored by the US-047 engine
// (decision 0015 §4 normative table); this module only maps an action *type* to
// a render target and decides when the material guardrail's confirm is needed.
// It never re-derives which tier an action belongs in.

import { CREDIT_ACTION_COSTS } from "./billing-credits.mjs";

const PLACEMENTS = ["primary", "secondary", "advanced"];

// action type -> credit action id, for the upfront cost hint on paid actions
// (decision 0020: credits are disclosed before the click, never discovered via
// a post-hoc balance error). Types absent here are free.
const ACTION_CREDIT_IDS = {
  generate_draft_cv: "tailored_cv_generation",
  generate_materials_anyway: "tailored_cv_generation",
  generate_cover_letter: "cover_letter",
  generate_roadmap: "roadmap",
  prepare_interview: "interview_prep",
};

export function actionCreditCost(type) {
  const creditActionId = ACTION_CREDIT_IDS[type];
  if (!creditActionId) {
    return null;
  }
  const item = CREDIT_ACTION_COSTS.find((cost) => cost.id === creditActionId);
  return item ? item.credits : null;
}

// type -> where it routes and how it renders.
//   scope: "match"   -> /matches/{id}{path}
//          "app"      -> {path} (absolute app route)
//          "self"     -> {path} on the current page (anchor)
//          "external" -> the job_url
//          "tracker"  -> a tracker mutation form (no href); trackerStatus says how
// material marks the generate-materials actions that the readiness guardrail gates.
export const ACTION_TARGETS = {
  generate_draft_cv: { path: "/draft-cv", scope: "match", material: "draft_cv" },
  generate_cover_letter: { path: "/cover-letter", scope: "match", material: "cover_letter" },
  generate_materials_anyway: { path: "/draft-cv", scope: "match", material: "both" },
  prepare_interview: { path: "/interview-prep", scope: "match" },
  view_skill_gaps: { path: "/gaps", scope: "match" },
  review_skill_gaps: { path: "/gaps", scope: "match" },
  review_resume_strategy: { path: "/resume-suggestions", scope: "match" },
  generate_resume_suggestions: { path: "/resume-suggestions", scope: "match" },
  generate_roadmap: { path: "/roadmap", scope: "match" },
  update_profile: { path: "/profile", scope: "app" },
  find_better_matches: { path: "/jobs", scope: "app" },
  open_apply_link: { scope: "external" },
  view_analysis_details: { path: "/advanced", scope: "match" },
  save_to_tracker: { scope: "tracker", trackerStatus: "saved" },
  save_reference: { scope: "tracker", trackerStatus: "archived" },
  // US-052 swaps this to the dedicated learning_target status + migration; until
  // then it lands in the tracker as a saved job so the button is never a no-op.
  save_learning_target: { scope: "tracker", trackerStatus: "learning_target" },
};

export const KNOWN_ACTION_TYPES = new Set(Object.keys(ACTION_TARGETS));

export function isKnownActionType(type) {
  return KNOWN_ACTION_TYPES.has(type);
}

// Group by placement, preserving the engine's priority order. An unknown action
// type — or an unknown placement value — lands under Advanced (forward
// compatibility, US-049 AC).
export function groupActions(actions) {
  const groups = { primary: [], secondary: [], advanced: [] };
  const list = Array.isArray(actions) ? actions : [];
  for (const action of list) {
    const validPlacement = PLACEMENTS.includes(action?.placement);
    const placement =
      isKnownActionType(action?.type) && validPlacement ? action.placement : "advanced";
    groups[placement].push(action);
  }
  for (const placement of PLACEMENTS) {
    groups[placement].sort((a, b) => (a?.priority ?? 0) - (b?.priority ?? 0));
  }
  return groups;
}

export function actionScope(type) {
  return ACTION_TARGETS[type]?.scope ?? "unknown";
}

export function trackerStatusFor(type) {
  return ACTION_TARGETS[type]?.trackerStatus ?? null;
}

// Resolve an action's link target. Returns null for tracker mutations (rendered
// as a form) and for unknown types (rendered inert).
export function actionHref(type, matchId, jobUrl) {
  const target = ACTION_TARGETS[type];
  if (!target) return null;
  switch (target.scope) {
    case "match":
      return `/matches/${matchId}${target.path}`;
    case "app":
    case "self":
      return target.path;
    case "external":
      return jobUrl || null;
    default:
      return null;
  }
}

export function isExternalAction(type) {
  return ACTION_TARGETS[type]?.scope === "external";
}

// The material guardrail: a generate-materials action needs an explicit
// "Generate Anyway" confirm whenever the relevant material readiness isn't
// "recommended" (decision 0015 §4 / brief Epic 10). "Generate Materials Anyway"
// always confirms — it only exists on weak decisions.
export function needsConfirm(type, materialReadiness) {
  const material = ACTION_TARGETS[type]?.material;
  if (!material) return false;
  if (material === "both") return true;
  const state = materialReadiness?.[material];
  return state !== undefined && state !== "recommended";
}

// The warning copy names the actual missing skills (US-049 AC) — never vague
// "several critical requirements" language.
export function materialWarning(missingSkills) {
  const named = (Array.isArray(missingSkills) ? missingSkills : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 2);
  if (named.length === 0) {
    return (
      "This role is a stretch right now. Review the generated materials carefully before " +
      "sending — they may overstate your fit."
    );
  }
  const skills = named.length === 2 ? `${named[0]} or ${named[1]}` : named[0];
  return (
    `Your profile doesn't show evidence for ${skills}. The generated materials can't claim ` +
    "it honestly — review carefully before you send."
  );
}

// Helper copy for "Keep for reference" — names the archived destination so the
// muted action explains itself (decision 0015 §4: no new tracker status).
export function trackerActionHelper(type) {
  if (type === "save_reference") {
    return "Archives this job for reference — it won't count as an active application.";
  }
  if (type === "save_learning_target") {
    return "Tracks this as a role you're building toward.";
  }
  if (type === "save_to_tracker") {
    return "Adds this job to your application tracker.";
  }
  return "";
}
