"use client";

import { AlertTriangle } from "lucide-react";

import {
  aiRelevanceBadge,
  transitionFriendlinessBadge,
} from "@/lib/job-search-flow.mjs";
import { nonAiWarning } from "@/lib/job-preview-flow.mjs";
import { Badge } from "@/components/ui/badge";

export type AiRelevance = {
  is_ai_related: boolean;
  ai_relevance_score: number;
  ai_role_category: string;
  transition_friendliness: string;
  research_heavy: boolean;
  engineering_focused: boolean;
  relevance_reason: string;
  detected_ai_keywords: string[];
  exclude_reason: string | null;
};

/**
 * Shared AI Role Relevance display — the "about the job" half of the honest-coach
 * split (Principle 2). Reused by the search result cards (US-075) and the
 * URL/paste preview (US-076). Render the candidate quick-match separately; this
 * component never mixes the two.
 */
export function JobRelevancePreview({
  aiRelevance,
  relevanceAvailable = true,
  hiddenExcludeReason,
}: {
  aiRelevance: AiRelevance | null;
  relevanceAvailable?: boolean;
  hiddenExcludeReason?: string | null;
}) {
  if (!relevanceAvailable || !aiRelevance) {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel />
        <p className="text-xs italic text-muted-foreground">
          AI relevance check unavailable — you can still review and save this job.
        </p>
      </div>
    );
  }

  const relBadge = aiRelevanceBadge(aiRelevance);
  const tfBadge = transitionFriendlinessBadge(aiRelevance.transition_friendliness);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel />
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={relBadge.variant as never}>{relBadge.label}</Badge>
        <Badge variant={tfBadge.variant as never}>{tfBadge.label}</Badge>
        {aiRelevance.research_heavy && <Badge variant="warning">Research-heavy</Badge>}
      </div>
      {aiRelevance.relevance_reason && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {aiRelevance.relevance_reason}
        </p>
      )}
      {hiddenExcludeReason && (
        <p className="text-xs italic text-muted-foreground/80">
          Hidden: {hiddenExcludeReason}
        </p>
      )}
    </div>
  );
}

/**
 * Section 17 non-AI warning — shown before save when the role is judged not
 * meaningfully AI-related. Never blocks: the caller wires "Add Anyway" and
 * "Find AI-related jobs instead". Renders nothing when there's no warning.
 */
export function NonAiWarning({
  aiRelevance,
  relevanceAvailable = true,
  onAddAnyway,
  onFindAiJobs,
}: {
  aiRelevance: AiRelevance | null;
  relevanceAvailable?: boolean;
  onAddAnyway: () => void;
  onFindAiJobs: () => void;
}) {
  const warning = nonAiWarning(aiRelevance, relevanceAvailable);
  if (!warning.warn) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/8 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 text-[oklch(0.55_0.13_70)]" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">This role may not be AI-related</p>
          <p className="text-xs text-muted-foreground">{warning.reason}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        <button
          className="text-xs font-medium underline underline-offset-2 hover:text-foreground"
          onClick={onAddAnyway}
          type="button"
        >
          Add anyway
        </button>
        <span className="text-xs text-muted-foreground">·</span>
        <button
          className="text-xs font-medium underline underline-offset-2 hover:text-foreground"
          onClick={onFindAiJobs}
          type="button"
        >
          Find AI-related jobs instead
        </button>
      </div>
    </div>
  );
}

function SectionLabel() {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      AI Relevance
    </p>
  );
}
