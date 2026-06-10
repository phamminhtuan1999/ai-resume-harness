/*
  Thin client for the standard Period 8 AI workflow envelope (US-027), reused by
  every AI feature endpoint (US-028+). The backend returns either:

    { workflow_run: {...}, result: {...} }                      (200)
    { error: { code, message, retryable } }                      (4xx/5xx)

  `runWorkflow` resolves to { workflowRun, result } or throws a typed
  `AIWorkflowError` carrying the friendly message + retryable flag, so callers
  can surface a Retry affordance. `runMatchAnalysis` is an action-friendly
  wrapper that returns the `{ ok, ... }` shape the rest of the app uses.

  A `fetchImpl` seam keeps it unit-testable without network.
*/

export class AIWorkflowError extends Error {
  constructor(message, { code = "internal_error", retryable = false } = {}) {
    super(message || "Something went wrong. Please try again.");
    this.name = "AIWorkflowError";
    this.code = code;
    this.retryable = retryable;
  }
}

export async function runWorkflow({
  apiBaseUrl,
  path,
  sessionToken,
  fetchImpl = fetch,
  body = null,
}) {
  if (!apiBaseUrl) {
    throw new AIWorkflowError("The assistant API is not configured.", {
      code: "internal_error",
      retryable: false,
    });
  }
  if (!sessionToken) {
    throw new AIWorkflowError("Unable to authenticate the request.", {
      code: "unauthorized",
      retryable: false,
    });
  }

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AIWorkflowError("We could not reach the assistant. Please try again.", {
      code: "network_failure",
      retryable: true,
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw toAIWorkflowError(payload, response.status);
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.workflow_run !== "object" ||
    payload.workflow_run === null ||
    typeof payload.result !== "object" ||
    payload.result === null
  ) {
    throw new AIWorkflowError("The assistant returned an unexpected response.", {
      code: "schema_validation_failure",
      retryable: true,
    });
  }

  return { workflowRun: payload.workflow_run, result: payload.result };
}

export async function runMatchAnalysis({
  apiBaseUrl,
  matchId,
  sessionToken,
  fetchImpl = fetch,
  regenerate = false,
}) {
  if (!matchId) {
    return { ok: false, message: "A match is required before analysis.", retryable: false };
  }

  const path = regenerate
    ? `/api/matches/${matchId}/analyze/regenerate`
    : `/api/matches/${matchId}/analyze`;

  try {
    const { workflowRun, result } = await runWorkflow({
      apiBaseUrl,
      path,
      sessionToken,
      fetchImpl,
    });
    return { ok: true, workflowRun, result };
  } catch (error) {
    if (error instanceof AIWorkflowError) {
      return {
        ok: false,
        message: error.message,
        code: error.code,
        retryable: error.retryable,
      };
    }
    return { ok: false, message: "The assistant request failed.", retryable: true };
  }
}

export async function runMatchSubWorkflow({
  apiBaseUrl,
  matchId,
  segment,
  sessionToken,
  fetchImpl = fetch,
  regenerate = false,
}) {
  if (!matchId) {
    return { ok: false, message: "A match is required.", retryable: false };
  }
  if (!segment) {
    return { ok: false, message: "A workflow step is required.", retryable: false };
  }

  const base = `/api/matches/${matchId}/${segment}`;
  const path = regenerate ? `${base}/regenerate` : base;

  try {
    const { workflowRun, result } = await runWorkflow({
      apiBaseUrl,
      path,
      sessionToken,
      fetchImpl,
    });
    return { ok: true, workflowRun, result };
  } catch (error) {
    if (error instanceof AIWorkflowError) {
      return {
        ok: false,
        message: error.message,
        code: error.code,
        retryable: error.retryable,
      };
    }
    return { ok: false, message: "The assistant request failed.", retryable: true };
  }
}

export async function patchResumeSuggestion({
  apiBaseUrl,
  suggestionId,
  sessionToken,
  userAction,
  suggestedText,
  fetchImpl = fetch,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "The assistant API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate the request." };
  }
  if (!suggestionId) {
    return { ok: false, message: "A suggestion is required." };
  }

  const body = { user_action: userAction };
  if (suggestedText !== null && suggestedText !== undefined) {
    body.suggested_text = suggestedText;
  }

  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/api/resume-suggestions/${suggestionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "We could not reach the assistant. Please try again." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      (typeof payload?.detail === "string" ? payload.detail : "Could not update the suggestion.");
    return { ok: false, message };
  }

  return { ok: true, suggestion: payload?.suggestion ?? null };
}

export async function patchDraftCvBullet({
  apiBaseUrl,
  draftCvId,
  bulletId,
  sessionToken,
  userAction,
  fetchImpl = fetch,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "The assistant API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate the request." };
  }
  if (!draftCvId || !bulletId) {
    return { ok: false, message: "A draft CV bullet is required." };
  }

  let response;
  try {
    response = await fetchImpl(
      `${apiBaseUrl}/api/draft-cvs/${draftCvId}/bullets/${bulletId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_action: userAction }),
      }
    );
  } catch {
    return { ok: false, message: "We could not reach the assistant. Please try again." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      (typeof payload?.detail === "string" ? payload.detail : "Could not update the bullet.");
    return { ok: false, message };
  }

  return { ok: true, draftCv: payload?.draft_cv ?? null };
}

export async function runFullWorkflow({
  apiBaseUrl,
  matchId,
  sessionToken,
  force = false,
  fetchImpl = fetch,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "The assistant API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate the request." };
  }
  if (!matchId) {
    return { ok: false, message: "A match is required." };
  }

  let response;
  try {
    response = await fetchImpl(
      `${apiBaseUrl}/api/matches/${matchId}/ai-workflow/run-full`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      }
    );
  } catch {
    return { ok: false, message: "We could not reach the assistant. Please try again." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = toAIWorkflowError(payload, response.status);
    return { ok: false, message: error.message, retryable: error.retryable };
  }

  return {
    ok: true,
    status: payload?.status ?? "complete",
    applicationStatus: payload?.application_status ?? null,
    stepsCompleted: Number(payload?.steps_completed) || 0,
    stepsFailed: Number(payload?.steps_failed) || 0,
    stepsBlocked: Number(payload?.steps_blocked) || 0,
    failedStep: payload?.failed_step ?? null,
    error: payload?.error ?? null,
  };
}

export async function fetchActivityFeed({
  apiBaseUrl,
  sessionToken,
  limit = 20,
  offset = 0,
  fetchImpl = fetch,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "The assistant API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate the request." };
  }

  let response;
  try {
    response = await fetchImpl(
      `${apiBaseUrl}/api/activities?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    );
  } catch {
    return { ok: false, message: "We could not reach the assistant. Please try again." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = toAIWorkflowError(payload, response.status);
    return { ok: false, message: error.message, retryable: error.retryable };
  }

  return {
    ok: true,
    activities: Array.isArray(payload?.activities) ? payload.activities : [],
    total: Number(payload?.total) || 0,
  };
}

export async function regenerateActivityDescription({
  apiBaseUrl,
  activityId,
  sessionToken,
  fetchImpl = fetch,
}) {
  if (!apiBaseUrl) {
    return { ok: false, message: "The assistant API is not configured." };
  }
  if (!sessionToken) {
    return { ok: false, message: "Unable to authenticate the request." };
  }
  if (!activityId) {
    return { ok: false, message: "An activity is required." };
  }

  let response;
  try {
    response = await fetchImpl(
      `${apiBaseUrl}/api/activities/${activityId}/generate-description`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      }
    );
  } catch {
    return { ok: false, message: "We could not reach the assistant. Please try again." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = toAIWorkflowError(payload, response.status);
    return { ok: false, message: error.message, retryable: error.retryable };
  }

  return { ok: true, activity: payload?.activity ?? null };
}

function toAIWorkflowError(payload, status) {
  const envelope =
    typeof payload === "object" && payload !== null && typeof payload.error === "object"
      ? payload.error
      : null;

  if (envelope) {
    return new AIWorkflowError(
      typeof envelope.message === "string" ? envelope.message : undefined,
      {
        code: typeof envelope.code === "string" ? envelope.code : "internal_error",
        retryable: Boolean(envelope.retryable),
      }
    );
  }

  // FastAPI HTTPException ({ detail }) or an opaque error: derive retryability
  // from the status class (5xx is worth retrying, 4xx is not).
  const detail =
    typeof payload === "object" && payload !== null && typeof payload.detail === "string"
      ? payload.detail
      : "The assistant request failed.";
  return new AIWorkflowError(detail, {
    code: status >= 500 ? "network_failure" : "internal_error",
    retryable: status >= 500,
  });
}
