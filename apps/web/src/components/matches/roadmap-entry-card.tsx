import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatShortDate } from "@/lib/data/server";

type RoadmapEntryCardProps = {
  matchId: string;
  generatedAt: string | null;
};

// US-051: a persistent home for a learning-target's 4-week roadmap on Overview
// (no seventh tab). Rendered only when a roadmap exists for the match.
export function RoadmapEntryCard({ matchId, generatedAt }: RoadmapEntryCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
            <CalendarCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Your 4-week roadmap</p>
            <p className="text-sm text-muted-foreground">
              A focused plan to close the skills this role needs
              {generatedAt ? ` · generated ${formatShortDate(generatedAt)}` : ""}
            </p>
          </div>
        </div>
        <Link
          href={`/matches/${matchId}/roadmap`}
          className={buttonVariants({ variant: "outline", className: "shrink-0" })}
        >
          View 4-week roadmap
        </Link>
      </CardContent>
    </Card>
  );
}
