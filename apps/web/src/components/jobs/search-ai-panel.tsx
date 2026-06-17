"use client";

import { useState, useActionState } from "react";
import { AlertCircle, ExternalLink, Search, ChevronDown, ChevronRight } from "lucide-react";

import type { SearchAiJob, SearchAiJobsState } from "@/lib/actions";
import { searchAiJobsAction } from "@/lib/actions";
import {
  groupJobResults,
  aiRelevanceBadge,
  quickMatchBadge,
  recommendedActionLabel,
  transitionFriendlinessBadge,
} from "@/lib/job-search-flow.mjs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/forms/submit-button";

const IDLE_STATE: SearchAiJobsState = { status: "idle", message: "" };

type SearchAiPanelProps = {
  onUsePaste: () => void;
  onUseUrl: () => void;
};

export function SearchAiPanel({ onUsePaste, onUseUrl }: SearchAiPanelProps) {
  const [state, formAction] = useActionState(searchAiJobsAction, IDLE_STATE);
  const [showHidden, setShowHidden] = useState(false);

  const result = state.result;
  const allJobs = result?.jobs ?? [];
  const { visible, hidden } = groupJobResults(allJobs);

  const hasProviderError =
    result?.error?.code === "search_not_configured" ||
    result?.error?.code === "search_unavailable";
  const isNotConfigured = result?.error?.code === "search_not_configured";

  return (
    <div className="flex flex-col gap-6 py-2">
      <SearchForm formAction={formAction} />

      {state.status === "error" && !result && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>
            {state.message}{" "}
            <button
              className="underline underline-offset-2"
              onClick={onUseUrl}
              type="button"
            >
              Try importing a job URL
            </button>{" "}
            or{" "}
            <button
              className="underline underline-offset-2"
              onClick={onUsePaste}
              type="button"
            >
              paste the job description
            </button>{" "}
            instead.
          </AlertDescription>
        </Alert>
      )}

      {hasProviderError && (
        <ProviderErrorState
          isNotConfigured={isNotConfigured}
          onUsePaste={onUsePaste}
          onUseUrl={onUseUrl}
        />
      )}

      {state.status === "results" && !hasProviderError && allJobs.length === 0 && (
        <EmptyState onUsePaste={onUsePaste} onUseUrl={onUseUrl} />
      )}

      {state.status === "results" && !hasProviderError && allJobs.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {result?.total_ai_related_results === 1
              ? "1 AI-related result"
              : `${result?.total_ai_related_results ?? 0} AI-related results`}
            {result?.total_provider_results != null &&
              ` of ${result.total_provider_results} listings`}
          </p>

          <div className="flex flex-col gap-3">
            {visible.map((job) => (
              <SearchJobCard key={job.external_job_id} job={job} />
            ))}
          </div>

          {hidden.length > 0 && (
            <div className="flex flex-col gap-3">
              <button
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowHidden((v) => !v)}
                type="button"
              >
                {showHidden ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                {showHidden ? "Hide" : "Show"} {hidden.length} hidden{" "}
                {hidden.length === 1 ? "job" : "jobs"} (below AI relevance threshold)
              </button>
              {showHidden &&
                hidden.map((job) => (
                  <SearchJobCard key={job.external_job_id} job={job} dimmed />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchForm({ formAction }: { formAction: (payload: FormData) => void }) {
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="search-role">
            Target role / keywords
          </label>
          <Input
            defaultValue="Applied AI Engineer"
            id="search-role"
            name="target_role"
            placeholder="Applied AI Engineer"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="search-location">
            Location
          </label>
          <Input
            defaultValue="Remote US"
            id="search-location"
            name="location"
            placeholder="Remote US"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="search-experience">
            Experience level
          </label>
          <Select id="search-experience" name="experience_level">
            <option value="">Any level</option>
            <option value="entry">Entry level</option>
            <option value="mid">Mid level</option>
            <option value="senior">Senior</option>
            <option value="staff">Staff / Principal</option>
            <option value="lead">Lead / Manager</option>
          </Select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input className="size-4 accent-brand" name="remote_only" type="checkbox" value="on" />
            Remote only
          </label>
        </div>
      </div>

      <div>
        <SubmitButton pendingLabel="Searching…">
          <Search className="size-4" />
          Search AI Jobs
        </SubmitButton>
      </div>
    </form>
  );
}

function SearchJobCard({ job, dimmed = false }: { job: SearchAiJob; dimmed?: boolean }) {
  const relBadge = aiRelevanceBadge(job.ai_relevance);
  const qmBadge = quickMatchBadge(job.quick_match);
  const tfBadge = job.ai_relevance
    ? transitionFriendlinessBadge(job.ai_relevance.transition_friendliness)
    : null;

  const quickMatchUnavailable = !job.quick_match || job.quick_match.unavailable;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${dimmed ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold leading-snug">{job.title}</h3>
          {job.company && (
            <p className="text-xs text-muted-foreground">{job.company}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {job.external_source}
          </Badge>
          {job.location && (
            <Badge variant="outline" className="text-xs">
              {job.location}
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* AI relevance — about the job */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI Relevance
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={relBadge.variant as never}>{relBadge.label}</Badge>
          {tfBadge && (
            <Badge variant={tfBadge.variant as never}>{tfBadge.label}</Badge>
          )}
          {job.ai_relevance?.research_heavy && (
            <Badge variant="warning">Research-heavy</Badge>
          )}
        </div>
        {job.ai_relevance?.relevance_reason && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {job.ai_relevance.relevance_reason}
          </p>
        )}
        {job.hidden && job.ai_relevance?.exclude_reason && (
          <p className="text-xs italic text-muted-foreground/80">
            Hidden: {job.ai_relevance.exclude_reason}
          </p>
        )}
      </div>

      <Separator />

      {/* Quick match — about the candidate's fit */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your Fit Preview
        </p>
        {quickMatchUnavailable ? (
          <p className="text-xs italic text-muted-foreground">
            Match preview unavailable
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={qmBadge.variant as never}>{qmBadge.label}</Badge>
              {job.quick_match?.recommended_action && (
                <span className="text-xs text-muted-foreground">
                  Suggested: {recommendedActionLabel(job.quick_match.recommended_action)}
                </span>
              )}
            </div>
            {job.quick_match?.assistant_preview && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {job.quick_match.assistant_preview}
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button disabled size="sm" type="button" variant="default">
          Save
        </Button>
        <Button disabled size="sm" type="button" variant="outline">
          Save &amp; Analyze
        </Button>
        {job.apply_url && (
          <a
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[0.8rem] font-medium text-foreground hover:bg-muted transition-colors"
            href={job.apply_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Open Apply Link
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  onUsePaste,
  onUseUrl,
}: {
  onUsePaste: () => void;
  onUseUrl: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-6">
      <p className="text-sm font-medium">No AI-related roles found</p>
      <p className="text-sm text-muted-foreground">
        Try broadening your search — use &quot;AI Engineer&quot; or &quot;Machine Learning&quot;,
        switch to Remote US, or show AI-adjacent results by adjusting your query.
      </p>
      <p className="text-sm text-muted-foreground">
        Already found a role?{" "}
        <button
          className="underline underline-offset-2 hover:text-foreground"
          onClick={onUseUrl}
          type="button"
        >
          Import the job URL
        </button>{" "}
        or{" "}
        <button
          className="underline underline-offset-2 hover:text-foreground"
          onClick={onUsePaste}
          type="button"
        >
          paste the description
        </button>
        .
      </p>
    </div>
  );
}

function ProviderErrorState({
  isNotConfigured,
  onUsePaste,
  onUseUrl,
}: {
  isNotConfigured: boolean;
  onUsePaste: () => void;
  onUseUrl: () => void;
}) {
  return (
    <Alert>
      <AlertCircle className="size-4" />
      <AlertTitle>
        {isNotConfigured ? "Job search not available" : "Search temporarily unavailable"}
      </AlertTitle>
      <AlertDescription>
        {isNotConfigured
          ? "Live job search is not configured for this environment. "
          : "Job search is temporarily unavailable. Try again in a moment. "}
        In the meantime you can{" "}
        <button
          className="underline underline-offset-2"
          onClick={onUseUrl}
          type="button"
        >
          import a job URL
        </button>{" "}
        or{" "}
        <button
          className="underline underline-offset-2"
          onClick={onUsePaste}
          type="button"
        >
          paste a job description
        </button>
        .
      </AlertDescription>
    </Alert>
  );
}
