import { companyInitials } from "@/lib/job-search-flow.mjs";
import { cn } from "@/lib/utils";

/**
 * A neutral company-initial tile used as the per-job identity anchor on both the
 * AI search results (US-075) and the saved-jobs table. The search payload
 * carries only a company name — no logo or domain — so this is a derived
 * monogram, not a brand logo, and is marked aria-hidden because the company
 * name is always rendered as text beside it.
 */
export function CompanyMonogram({
  company,
  title = "",
  className,
}: {
  company: string | null;
  title?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-sm font-medium text-foreground",
        className
      )}
    >
      {companyInitials(company ?? "", title)}
    </div>
  );
}
