"use client";

import { useState, type ReactNode } from "react";

import { JobForm } from "@/components/forms/job-form";
import { JobUrlForm } from "@/components/forms/job-url-form";
import { SearchAiPanel } from "@/components/jobs/search-ai-panel";
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
            <SearchAiPanel
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
