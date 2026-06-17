import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { summarizeTrackerDistribution } from "@/lib/application-tracker.mjs";

// Quiet, group-colored distribution over the existing status groups (US-080).
// Per the honest-coach design we don't reach for a rainbow palette: one accent
// for the active pipeline, muted for closed, warning for learning. Precise
// per-status counts live in the legend, not implied by colour.
const GROUP_BAR: Record<string, string> = {
  pipeline: "bg-primary",
  closed: "bg-muted-foreground/40",
  learning: "bg-warning",
};

type TrackerRow = { status?: string | null };

export function TrackerDistribution({ applications }: { applications: readonly TrackerRow[] }) {
  const { buckets, rollups, isEmpty } = summarizeTrackerDistribution(applications);
  const visible = buckets.filter((bucket) => bucket.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline overview</CardTitle>
        <CardDescription>How your tracked applications are distributed.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            No applications tracked yet — save a job and set its status to see your pipeline
            distribution here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Rollup label="Active applications" value={rollups.active} />
              <Rollup label="Closed" value={rollups.closed} />
              <Rollup label="Learning targets" value={rollups.learning} />
            </div>

            <div
              aria-label="Application status distribution"
              className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted"
              role="img"
            >
              {visible.map((bucket) => (
                <div
                  className={GROUP_BAR[bucket.group ?? ""] ?? "bg-muted-foreground/40"}
                  key={bucket.status}
                  style={{ width: `${(bucket.count / rollups.total) * 100}%` }}
                  title={`${bucket.label}: ${bucket.count}`}
                />
              ))}
            </div>

            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {visible.map((bucket) => (
                <li
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  key={bucket.status}
                >
                  <span
                    className={`size-2 rounded-full ${GROUP_BAR[bucket.group ?? ""] ?? "bg-muted-foreground/40"}`}
                  />
                  <span className="font-medium text-foreground">{bucket.label}</span>
                  <span className="tabular-nums">{bucket.count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Rollup({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
