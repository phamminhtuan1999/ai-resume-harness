import { Fragment } from "react";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { decisionMeta } from "@/lib/analysis-package-view.mjs";
import {
  droppedRunsLine,
  historyTransition,
  inputFreshnessParts,
  rulesVersionChanged,
} from "@/lib/history-view.mjs";
import { formatShortDate } from "@/lib/data/server";
import type { AnalysisDecisionHistory } from "@/lib/data/server";

type AnalysisHistoryProps = {
  history: AnalysisDecisionHistory | null;
};

// US-054: read-only decision history, rendered only inside the Advanced tab.
// Newest-first, with rules-version markers so a rules-driven label change never
// reads as the user's fit changing.
export function AnalysisHistory({ history }: AnalysisHistoryProps) {
  const entries = history?.entries ?? [];
  const dropped = droppedRunsLine(history?.dropped ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <History className="size-4" />
          </div>
          <div>
            <CardTitle>Analysis history</CardTitle>
            <CardDescription>
              Every time this analysis was run, and the decision it produced.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            History starts with your first refreshed analysis. Run Refresh Analysis to record a
            decision snapshot here.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Inputs used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => {
                  const meta = decisionMeta(entry.label);
                  const transition = historyTransition(entry);
                  const freshness = inputFreshnessParts(entry)[0] ?? null;
                  const older = entries[index + 1];
                  const showRulesMarker = older ? rulesVersionChanged(entry, older) : false;

                  return (
                    <Fragment key={entry.id ?? `${entry.decided_at}-${index}`}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {entry.decided_at ? formatShortDate(entry.decided_at) : "—"}
                        </TableCell>
                        <TableCell>
                          {meta ? <Badge variant={meta.variant}>{meta.display}</Badge> : entry.display_label}
                          {transition.changed ? (
                            <p className="mt-1 text-xs text-muted-foreground">{transition.text}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {typeof entry.match_score === "number" ? Math.round(entry.match_score) : "—"}
                        </TableCell>
                        <TableCell className="capitalize">{entry.risk_level ?? "—"}</TableCell>
                        <TableCell>
                          {typeof entry.confidence === "number"
                            ? `${Math.round(entry.confidence * 100)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-normal text-muted-foreground">
                          {freshness
                            ? `Used ${freshness.label} updated ${formatShortDate(freshness.updatedAt)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                      {showRulesMarker ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/40 text-xs text-muted-foreground">
                            Decision rules updated below this point — a verdict change here reflects
                            updated rules, not a change in your fit.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {dropped ? (
              <p className="mt-3 text-xs text-muted-foreground">{dropped}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
