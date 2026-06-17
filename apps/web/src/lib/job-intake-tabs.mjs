// Tab model for the Add Job hub (US-070). Plain ESM so the client component
// (job-intake.tsx) and the node --test suite both import the same source of
// truth. No rendering, no I/O.
//
// The three intake methods flow through the same gate later in Period 16
// (normalize → AI Role Relevance → Quick Match → Save). This file only fixes
// the tab order, labels, and default; the Search tab's working behavior lands
// in US-073/074/075.

// Order is fixed and label-independent. Search is first because ApplyWise is
// positioned as a career assistant that proactively finds AI-transition roles
// (spec §6 default tab).
export const JOB_INTAKE_TABS = [
  { key: "search", label: "Search AI Jobs" },
  { key: "url", label: "Import Job URL" },
  { key: "manual", label: "Paste Job Description" },
];

export const DEFAULT_JOB_INTAKE_TAB = "search";

const TAB_KEYS = new Set(JOB_INTAKE_TABS.map((t) => t.key));

export function isJobIntakeTab(key) {
  return TAB_KEYS.has(key);
}

// The active tab for a requested key: a known key selects itself; anything
// unknown (bad deep link, stale state) falls back to the default rather than
// rendering an empty panel.
export function resolveJobIntakeTab(key) {
  return isJobIntakeTab(key) ? key : DEFAULT_JOB_INTAKE_TAB;
}
