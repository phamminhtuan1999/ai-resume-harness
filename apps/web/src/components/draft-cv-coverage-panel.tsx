import { MoveRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CoverageReport = {
  claimableCount: number;
  basePercent: number;
  tailoredPercent: number;
  delta: number;
  covered: string[];
  missing: string[];
  notClaimable: string[];
};

// Deterministic tailoring-coverage panel (US-062). Server-rendered from the
// same data the page already loads; review/edit actions revalidate the page,
// so the numbers move without a browser reload. Explicitly NOT the match
// score — the decision label stays computed on the base resume.
export function DraftCvCoveragePanel({ report }: { report: CoverageReport }) {
  if (!report.claimableCount && !report.notClaimable.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tailoring coverage</CardTitle>
        <CardDescription>
          How many of the job&apos;s keywords your exportable CV content covers. This is
          tailoring progress — not your match score, which stays based on your base resume.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            Base resume <span className="font-semibold text-foreground">{report.basePercent}%</span>
          </span>
          <MoveRight className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">
            Tailored CV{" "}
            <span className="font-semibold text-foreground">{report.tailoredPercent}%</span>
          </span>
          {report.delta !== 0 ? (
            <Badge variant={report.delta > 0 ? "success" : "warning"}>
              {report.delta > 0 ? "+" : ""}
              {report.delta} pts
            </Badge>
          ) : null}
        </div>

        {report.covered.length ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Covered</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {report.covered.map((keyword) => (
                <Badge key={keyword} variant="success">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {report.missing.length ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Not covered yet</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {report.missing.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {report.notClaimable.length ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Not claimable (excluded by Truth Guard)
            </p>
            <p className="text-xs text-muted-foreground">
              Your evidence doesn&apos;t support these yet, so they don&apos;t count against your
              coverage — build the proof first instead of claiming them.
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {report.notClaimable.map((keyword) => (
                <Badge key={keyword} variant="destructive">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
