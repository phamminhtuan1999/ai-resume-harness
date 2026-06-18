import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildTrackerNextSteps } from "@/lib/tracker-next-steps.mjs";

// Product-native next-step routing for /tracker (US-084). Derives its routes
// from the rows getTrackerData already loads, so it adds no query. Every action
// links to an implemented route.

type NextStepRow = {
  status: string;
  match_id: string | null;
};

// Search AI Jobs is a planned Period 16 intake with no route yet. Keep this null
// so the action stays hidden and can never render broken; point it at the real
// path once that intake ships.
const SEARCH_AI_JOBS_HREF: string | null = null;

export function TrackerNextSteps({ applications }: { applications: readonly NextStepRow[] }) {
  const { steps, isEmpty } = buildTrackerNextSteps(applications, {
    searchJobsHref: SEARCH_AI_JOBS_HREF,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Compass aria-hidden className="size-4 text-muted-foreground" />
          <CardTitle>Next steps</CardTitle>
        </div>
        <CardDescription>Product-native actions to keep your search moving.</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re all caught up — no pending next steps.{" "}
            <Link className="font-medium underline underline-offset-4" href="/jobs/new">
              Add a job
            </Link>{" "}
            when you find a new role.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                  href={step.href}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-xs text-muted-foreground">{step.description}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
