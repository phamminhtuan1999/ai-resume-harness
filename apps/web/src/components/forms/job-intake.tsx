"use client";

import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { JobForm } from "@/components/forms/job-form";
import { JobUrlForm } from "@/components/forms/job-url-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEFAULT_JOB_INTAKE_TAB,
  JOB_INTAKE_TABS,
  resolveJobIntakeTab,
} from "@/lib/job-intake-tabs.mjs";
import { cn } from "@/lib/utils";

type IntakeTab = "search" | "url" | "manual";

export function JobIntake() {
  const [tab, setTab] = useState<IntakeTab>(DEFAULT_JOB_INTAKE_TAB as IntakeTab);
  const [url, setUrl] = useState("");

  // A bad/stale tab value renders the default panel rather than nothing.
  const active = resolveJobIntakeTab(tab) as IntakeTab;

  return (
    <div className="flex flex-col gap-5">
      <div
        aria-label="Job intake method"
        className="inline-flex w-fit flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        role="tablist"
      >
        {JOB_INTAKE_TABS.map((t) => (
          <ModeTab
            key={t.key}
            active={active === t.key}
            onClick={() => setTab(t.key as IntakeTab)}
          >
            {t.label}
          </ModeTab>
        ))}
      </div>

      <Card>
        <CardContent>
          {active === "search" ? (
            <SearchComingSoon
              onUsePaste={() => setTab("manual")}
              onUseUrl={() => setTab("url")}
            />
          ) : active === "url" ? (
            <JobUrlForm
              onUrlChange={setUrl}
              onUseManual={() => setTab("manual")}
              url={url}
            />
          ) : (
            <JobForm defaultJobUrl={url} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// US-070 ships the Search tab as a shell. The placeholder is honest about what
// is and isn't available yet (no fake search box, no implied AI verdict) and
// keeps the page fully usable by pointing at the two working intake methods.
function SearchComingSoon({
  onUsePaste,
  onUseUrl,
}: {
  onUsePaste: () => void;
  onUseUrl: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4 py-2">
      <span className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-brand">
        <Search className="size-5" />
      </span>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Search AI Jobs</h2>
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        Soon you&apos;ll search live listings here and ApplyWise will surface the
        roles that fit your AI Engineer path — checking each one for AI relevance
        and a quick match preview before you save. It isn&apos;t live yet.
      </p>
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        Already found a role? Import it now:
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onUseUrl} type="button" variant="outline">
          Import Job URL
        </Button>
        <Button onClick={onUsePaste} type="button" variant="outline">
          Paste Job Description
        </Button>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}
