"use client";

import { useState, type ReactNode } from "react";

import { JobForm } from "@/components/forms/job-form";
import { JobUrlForm } from "@/components/forms/job-url-form";
import { cn } from "@/lib/utils";

export function JobIntake() {
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <div
        aria-label="Job intake mode"
        className="inline-flex w-fit gap-1 rounded-lg border bg-muted/40 p-1"
        role="tablist"
      >
        <ModeTab active={mode === "url"} onClick={() => setMode("url")}>
          Add by URL
        </ModeTab>
        <ModeTab active={mode === "manual"} onClick={() => setMode("manual")}>
          Paste manually
        </ModeTab>
      </div>
      {mode === "url" ? (
        <JobUrlForm
          onUrlChange={setUrl}
          onUseManual={() => setMode("manual")}
          url={url}
        />
      ) : (
        <JobForm defaultJobUrl={url} />
      )}
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
