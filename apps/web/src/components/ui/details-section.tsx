import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/*
  Server-friendly expand/collapse built on native <details> — zero client JS.
  Used for inline review surfaces (raw text, AI step digests) so reading does
  not require navigating to a separate page.

  "card" is the standalone bordered section; "ghost" is a quiet text toggle for
  use inside an existing container (e.g. a stepper row) where a nested card
  would read as box-in-box.
*/

type DetailsSectionProps = {
  summary: React.ReactNode;
  defaultOpen?: boolean;
  variant?: "card" | "ghost";
  className?: string;
  children: React.ReactNode;
};

export function DetailsSection({
  summary,
  defaultOpen = false,
  variant = "card",
  className,
  children,
}: DetailsSectionProps) {
  if (variant === "ghost") {
    return (
      <details open={defaultOpen} className={cn("group", className)}>
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">{summary}</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="details-content pt-2">{children}</div>
      </details>
    );
  }

  return (
    <details
      open={defaultOpen}
      className={cn("group rounded-lg border bg-card", className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="details-content border-t px-4 py-4">{children}</div>
    </details>
  );
}
