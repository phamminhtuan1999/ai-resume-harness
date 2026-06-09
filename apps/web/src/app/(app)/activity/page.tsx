import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { RegenerateActivityButton } from "@/components/forms/regenerate-activity-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatRelativeTime,
  groupActivities,
  importanceVariant,
  paginationMeta,
} from "@/lib/activity-feed.mjs";
import { getActivityFeedPage } from "@/lib/data/server";

const PAGE_SIZE = 20;

type ActivityGroup = {
  id: string;
  activity_type: string;
  title: string;
  assistant_description: string;
  importance: "low" | "medium" | "high";
  created_at: string;
  related_job: { id: string; title: string; company: string } | null;
  count: number;
  also_ran: string[];
};

type PageMeta = {
  page: number;
  totalPages: number;
  total: number;
  offset: number;
  start: number;
  end: number;
  hasPrev: boolean;
  hasNext: boolean;
};

type ActivityPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Math.trunc(Number(pageParam)) || 1);

  let { rows, total } = await getActivityFeedPage(
    (requestedPage - 1) * PAGE_SIZE,
    PAGE_SIZE
  );
  let meta = paginationMeta({ page: requestedPage, pageSize: PAGE_SIZE, total }) as PageMeta;
  if (meta.page !== requestedPage) {
    // Out-of-range page in the URL: clamp and refetch the last real page.
    ({ rows, total } = await getActivityFeedPage(meta.offset, PAGE_SIZE));
    meta = paginationMeta({ page: meta.page, pageSize: PAGE_SIZE, total }) as PageMeta;
  }

  // Run-full bursts collapse into one row per job (headline = highest signal).
  const items = groupActivities(rows) as ActivityGroup[];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        description="Everything ApplyWise has done across your job search, newest first."
        title="Activity"
      />

      <Card>
        <CardHeader>
          <CardTitle>AI assistant events</CardTitle>
          <CardDescription>
            {items.length > 0
              ? "Each event explains what happened and why it matters. Events older than 90 days are removed automatically."
              : "Events appear here as AI steps run across your matches."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Importance</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Related job</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Refresh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge
                        variant={importanceVariant(item.importance) as never}
                        aria-label={`Importance: ${item.importance}`}
                      >
                        {item.importance}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xl">
                      <p className="text-sm font-medium break-words whitespace-normal">
                        {item.title}
                      </p>
                      {item.assistant_description ? (
                        <p className="mt-1 text-sm leading-6 break-words whitespace-normal text-muted-foreground">
                          {item.assistant_description}
                        </p>
                      ) : null}
                      {item.also_ran.length > 0 ? (
                        <p className="mt-1 text-xs break-words whitespace-normal text-muted-foreground">
                          Also ran: {item.also_ran.join(", ")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {item.related_job?.id ? (
                        <Link
                          href={`/jobs/${item.related_job.id}`}
                          aria-label={`View job: ${item.related_job.title} at ${item.related_job.company}`}
                          className="flex w-fit items-center gap-1 text-sm font-medium text-foreground underline"
                        >
                          <span className="max-w-44 truncate">
                            {item.related_job.company} · {item.related_job.title}
                          </span>
                          <ArrowUpRight className="size-3.5 shrink-0" />
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatRelativeTime(item.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <RegenerateActivityButton activityId={item.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              description="Run a match analysis or generate a cover letter to see assistant activity here."
              title="No activity yet"
            />
          )}

          {meta.total > PAGE_SIZE ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {meta.start}–{meta.end} of {meta.total} events · Page{" "}
                {meta.page} of {meta.totalPages}
              </p>
              <div className="flex items-center gap-2">
                {meta.hasPrev ? (
                  <Link
                    href={`/activity?page=${meta.page - 1}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Previous
                  </Link>
                ) : null}
                {meta.hasNext ? (
                  <Link
                    href={`/activity?page=${meta.page + 1}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
