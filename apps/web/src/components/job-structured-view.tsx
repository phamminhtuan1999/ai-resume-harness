import { Badge } from "@/components/ui/badge";
import { normalizeStructuredJob } from "@/lib/job-structured-view.mjs";

/*
  Friendly full-detail renderer for a parsed job (US-018 JobExtraction shape):
  fact chips plus responsibility/skill/requirement sections. Returns null when
  the job has no structured data so callers can fall back to the raw text.
*/

type JobView = {
  has_structured: boolean;
  facts: { label: string; value: string }[];
  sections: { label: string; items: string[]; style: "list" | "badges" }[];
  confidence_score: number | null;
};

export function JobStructuredView({
  structuredJson,
  jobRow,
}: {
  structuredJson: unknown;
  jobRow?: Record<string, unknown>;
}) {
  const view = normalizeStructuredJob(structuredJson, jobRow) as JobView;

  if (!view.has_structured) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 text-sm md:grid-cols-3">
        {view.facts.map((fact) => (
          <div key={fact.label}>
            <p className="font-medium">{fact.label}</p>
            <p className="break-words text-muted-foreground">{fact.value}</p>
          </div>
        ))}
        {view.confidence_score !== null ? (
          <div>
            <p className="font-medium">Extraction confidence</p>
            <p className="text-muted-foreground">
              {Math.round(view.confidence_score * 100)}%
            </p>
          </div>
        ) : null}
      </div>

      {view.sections.map((jobSection) => (
        <div key={jobSection.label}>
          <p className="text-sm font-medium">{jobSection.label}</p>
          {jobSection.style === "badges" ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {jobSection.items.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          ) : (
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-muted-foreground">
              {jobSection.items.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
