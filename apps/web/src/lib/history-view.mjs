// Pure view helpers for the decision history (US-054). Plain ESM so the server
// component and the node --test suite share one source. Display formatting of
// label transitions, input freshness, and the rules-version marker all live here
// (one helper, per the packet) — raw snapshot ids are never rendered.

import { decisionDisplay } from "./analysis-package-view.mjs";

// The label transition for a history entry. changed=false when there's no prior
// decision (first run) or the verdict held — never a false "changed".
export function historyTransition(entry) {
  const prev = entry?.previous_label ?? null;
  const label = entry?.label ?? null;
  if (prev && label && prev !== label) {
    return {
      changed: true,
      from: prev,
      to: label,
      text: `${decisionDisplay(prev)} → ${decisionDisplay(label)}`,
    };
  }
  return { changed: false, from: prev, to: label, text: null };
}

// Whether a "decision rules updated" marker belongs between two adjacent entries
// (a newest-first list). A label change caused by rule tuning must never read as
// the user's fit changing (decision 0015 §7).
export function rulesVersionChanged(newerEntry, olderEntry) {
  const a = newerEntry?.rules_version;
  const b = olderEntry?.rules_version;
  return Boolean(a && b && a !== b);
}

// Which inputs to mention for freshness. The component formats the timestamps
// into user language ("Used profile updated Jun 10, 2026").
export function inputFreshnessParts(entry) {
  const inputs = entry?.inputs ?? {};
  const parts = [];
  if (inputs.profile_updated_at) {
    parts.push({ key: "profile", label: "profile", updatedAt: inputs.profile_updated_at });
  }
  if (inputs.resume_updated_at) {
    parts.push({ key: "resume", label: "résumé", updatedAt: inputs.resume_updated_at });
  }
  if (inputs.job_updated_at) {
    parts.push({ key: "job", label: "job", updatedAt: inputs.job_updated_at });
  }
  return parts;
}

// The dropped-count line ("12 older runs not shown"), or null when nothing was
// dropped — a capped list never silently reads as the whole story.
export function droppedRunsLine(dropped) {
  const count = Number(dropped) || 0;
  if (count <= 0) return null;
  return `${count} older ${count === 1 ? "run" : "runs"} not shown`;
}
