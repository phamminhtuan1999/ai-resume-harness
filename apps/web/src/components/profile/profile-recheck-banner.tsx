import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ProfileRecheckBannerProps = {
  matchId: string;
};

// US-053: shown when the user arrives from a job analysis (/profile?recheck=...)
// to strengthen their profile. After saving, it sends them back to Refresh the
// analysis — closing decision 0015 §10's "profile edits make decisions stale" loop
// from the profile end.
export function ProfileRecheckBanner({ matchId }: ProfileRecheckBannerProps) {
  return (
    <Card className="border-brand/40 bg-brand-muted/40">
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
            <RefreshCw className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Re-check your analysis</p>
            <p className="text-sm text-muted-foreground">
              You came here to strengthen a job analysis. Save your profile changes below, then head
              back and Refresh Analysis to see your updated fit.
            </p>
          </div>
        </div>
        <Link
          href={`/matches/${matchId}`}
          className={buttonVariants({ variant: "outline", className: "shrink-0" })}
        >
          Back to the analysis
        </Link>
      </CardContent>
    </Card>
  );
}
