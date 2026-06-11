import Link from "next/link";
import { Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pathForward } from "@/lib/analysis-package-view.mjs";
import type { AnalysisPackage } from "@/lib/data/server";

type DecisionRecommendationProps = {
  decision: NonNullable<AnalysisPackage["decision"]>;
  evidence: AnalysisPackage["evidence"];
};

export function DecisionRecommendation({ decision, evidence }: DecisionRecommendationProps) {
  // not_recommended must always name the concrete path forward, never only the
  // verdict (US-048 AC).
  const path = pathForward(decision.label, evidence.missing);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles data-icon="inline-start" className="size-4 text-brand" />
          What ApplyWise recommends
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {decision.summary ? (
          <p className="text-sm leading-6">{decision.summary}</p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Your assessment is ready below.
          </p>
        )}

        {path ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium">Your path forward</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{path}</p>
            <Link
              href="/profile"
              className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3 w-fit" })}
            >
              Update your profile
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
