"use client";

import { useState, useActionState } from "react";
import { AlertCircle, Search, ChevronDown, ChevronRight } from "lucide-react";

import type { SearchAiJob, SearchAiJobsState } from "@/lib/actions";
import { searchAiJobsAction } from "@/lib/actions";
import {
  aiRelevanceBadge,
  groupJobResults,
  quickMatchBadge,
  searchFitTier,
  sortSearchJobs,
  filterSearchJobs,
} from "@/lib/job-search-flow.mjs";
import { CompanyMonogram } from "@/components/jobs/company-monogram";
import { IntakeSaveActions } from "@/components/jobs/intake-save-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/forms/submit-button";
import { cn } from "@/lib/utils";

const IDLE_STATE: SearchAiJobsState = { status: "idle", message: "" };

type SearchFilters = {
  strongAi: boolean;
  transitionFriendly: boolean;
  strongFit: boolean;
};

const NO_FILTERS: SearchFilters = {
  strongAi: false,
  transitionFriendly: false,
  strongFit: false,
};

type SearchAiPanelProps = {
  onUsePaste: () => void;
  onUseUrl: () => void;
};

export function SearchAiPanel({ onUsePaste, onUseUrl }: SearchAiPanelProps) {
  const [state, formAction, isPending] = useActionState(searchAiJobsAction, IDLE_STATE);
  const [showHidden, setShowHidden] = useState(false);
  const [sortKey, setSortKey] = useState("recommended");
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS);

  const result = state.result;
  const allJobs = result?.jobs ?? [];
  const { visible, hidden } = groupJobResults(allJobs);
  // Sort + filter run client-side over the already-fetched page; they read only
  // fields each job already carries, so they never spend a request or a credit.
  const processed = sortSearchJobs(filterSearchJobs(visible, filters), sortKey);

  const toggleFilter = (key: keyof SearchFilters) =>
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

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
          <ResultsToolbar
            filters={filters}
            onSortChange={setSortKey}
            onToggleFilter={toggleFilter}
            shownCount={processed.length}
            sortKey={sortKey}
            totalAi={result?.total_ai_related_results ?? 0}
            totalProvider={result?.total_provider_results ?? null}
            visibleCount={visible.length}
          />

          {processed.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {processed.map((job: SearchAiJob) => (
                <SearchJobCard key={job.external_job_id} job={job} />
              ))}
            </div>
          ) : (
            <FilteredEmpty onClear={() => setFilters(NO_FILTERS)} />
          )}

          {hidden.length > 0 && (
            <div className="flex flex-col gap-4">
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
              {showHidden && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {hidden.map((job: SearchAiJob) => (
                    <SearchJobCard key={job.external_job_id} job={job} dimmed />
                  ))}
                </div>
              )}
            </div>
          )}

          {result?.has_more && (
            <div className="flex justify-center pt-1">
              {/* Outside the form, but submits it via form= so the same query is
                  re-run with intent=more (the server derives the next page). */}
              <button
                className={cn(buttonVariants({ variant: "outline" }))}
                disabled={isPending}
                form="search-ai-form"
                name="intent"
                type="submit"
                value="more"
              >
                {isPending ? "Loading…" : "Load more results"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchForm({ formAction }: { formAction: (payload: FormData) => void }) {
  // Controlled fields: React auto-resets an uncontrolled action form after the
  // action completes, which would snap the query back to its default after every
  // search / "Load more". Holding the values in state keeps what the user typed.
  const [targetRole, setTargetRole] = useState("Applied AI Engineer");
  const [location, setLocation] = useState("US");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3" id="search-ai-form">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium" htmlFor="search-role">
            Role / keywords
          </label>
          <Input
            id="search-role"
            name="target_role"
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="Applied AI Engineer"
            value={targetRole}
          />
        </div>
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium" htmlFor="search-location">
            Location
          </label>
          <Input
            id="search-location"
            name="location"
            onChange={(e) => setLocation(e.target.value)}
            placeholder="US"
            value={location}
          />
        </div>
        <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium" htmlFor="search-experience">
            Experience
          </label>
          <Select
            id="search-experience"
            name="experience_level"
            onChange={(e) => setExperienceLevel(e.target.value)}
            value={experienceLevel}
          >
            <option value="">Any level</option>
            <option value="entry">Entry level</option>
            <option value="mid">Mid level</option>
            <option value="senior">Senior</option>
            <option value="staff">Staff / Principal</option>
            <option value="lead">Lead / Manager</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            checked={remoteOnly}
            className="size-4 accent-brand"
            name="remote_only"
            onChange={(e) => setRemoteOnly(e.target.checked)}
            type="checkbox"
            value="on"
          />
          Remote only
        </label>
        <SubmitButton pendingLabel="Searching…">
          <Search className="size-4" />
          Search AI jobs
        </SubmitButton>
      </div>
    </form>
  );
}

function ResultsToolbar({
  filters,
  onSortChange,
  onToggleFilter,
  shownCount,
  sortKey,
  totalAi,
  totalProvider,
  visibleCount,
}: {
  filters: SearchFilters;
  onSortChange: (key: string) => void;
  onToggleFilter: (key: keyof SearchFilters) => void;
  shownCount: number;
  sortKey: string;
  totalAi: number;
  totalProvider: number | null;
  visibleCount: number;
}) {
  const filtered = shownCount !== visibleCount;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{totalAi}</span>{" "}
        {totalAi === 1 ? "AI-related result" : "AI-related results"}
        {totalProvider != null && ` of ${totalProvider} listings`}
        {filtered && ` · ${shownCount} shown`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filters.strongAi} onClick={() => onToggleFilter("strongAi")}>
          Strong AI
        </FilterChip>
        <FilterChip
          active={filters.transitionFriendly}
          onClick={() => onToggleFilter("transitionFriendly")}
        >
          Transition-friendly
        </FilterChip>
        <FilterChip active={filters.strongFit} onClick={() => onToggleFilter("strongFit")}>
          Strong fit
        </FilterChip>
        <label className="sr-only" htmlFor="search-sort">
          Sort results
        </label>
        <div className="w-44">
          <Select
            id="search-sort"
            onChange={(e) => onSortChange(e.target.value)}
            value={sortKey}
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="relevance">Sort: AI relevance</option>
            <option value="fit">Sort: Best fit</option>
            <option value="newest">Sort: Newest</option>
          </Select>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none",
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

// The single point of colour on a card: a small dot whose hue reports the
// candidate fit (searchFitTier). Strong is emerald, possible is amber, and
// everything else (weak/unavailable) stays a neutral grey so a poor match never
// shouts. Everything else on the card is monochrome.
const FIT_DOT: Record<string, string> = {
  strong: "bg-success",
  possible: "bg-warning",
  none: "bg-muted-foreground/40",
};

// Soft background wash so every card carries colour at a glance: emerald for a
// strong fit, amber for a possible one, a quiet neutral tint otherwise. Kept low
// (~8%) so it reads as a calm wash, not a paint-by-tier card.
const FIT_WASH: Record<string, string> = {
  strong: "border-success/30 bg-success/[0.08]",
  possible: "border-warning/40 bg-warning/[0.09]",
  none: "border-border bg-muted/50",
};

function SearchJobCard({ job, dimmed = false }: { job: SearchAiJob; dimmed?: boolean }) {
  const subtitle = [job.company, job.location].filter(Boolean).join(" · ");
  const tier = searchFitTier(job.quick_match);
  const fitLabel = quickMatchBadge(job.quick_match).label;

  // One quiet line of "about the job" signal — relevance, then any flags.
  const rel = job.ai_relevance;
  const aiSignal = rel
    ? [
        aiRelevanceBadge(rel).label,
        rel.transition_friendliness === "high" ? "transition-friendly" : null,
        rel.research_heavy ? "research-heavy" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-4",
        FIT_WASH[tier],
        dimmed && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <CompanyMonogram
          className="size-9 rounded-lg text-xs"
          company={job.company}
          title={job.title}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">{job.title}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {subtitle || "Company not specified"}
          </p>
        </div>
      </div>

      {job.salary_range && (
        <p className="mt-3 text-xs text-foreground">{job.salary_range}</p>
      )}

      <p className="mt-2.5 flex items-center gap-2 text-xs text-foreground">
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", FIT_DOT[tier])}
        />
        {fitLabel}
      </p>

      {aiSignal && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{aiSignal}</p>
      )}

      {job.hidden && job.ai_relevance?.exclude_reason && (
        <p className="mt-1.5 text-[11px] italic text-muted-foreground/80">
          Hidden: {job.ai_relevance.exclude_reason}
        </p>
      )}

      <div className="mt-4">
        <IntakeSaveActions
          applyUrl={job.apply_url}
          jobTitle={job.title}
          mode="search"
          payload={job}
          primaryAction="analyze"
        />
      </div>
    </div>
  );
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6">
      <p className="text-sm font-medium">No results match these filters</p>
      <p className="text-sm text-muted-foreground">
        Clear the filters to see all AI-related results for this search.
      </p>
      <button
        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        onClick={onClear}
        type="button"
      >
        Clear filters
      </button>
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
