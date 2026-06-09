import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/*
  Server-friendly expand/collapse built on native <details> — zero client JS.
  Used for inline review surfaces (raw text, AI step output) so reading does
  not require navigating to a separate page.
*/

type DetailsSectionProps = {
  summary: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function DetailsSection({
  summary,
  defaultOpen = false,
  className,
  children,
}: DetailsSectionProps) {
  return (
    <details
      open={defaultOpen}
      className={cn("group rounded-lg border bg-card", className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  );
}
