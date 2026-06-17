import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildInterviewAgenda } from "@/lib/interview-calendar.mjs";
import { formatShortDate } from "@/lib/data/server";

// Internal interview agenda for /tracker (US-083). Reads the rows already loaded
// by getTrackerData (owned-scoped there) and groups the ones with a scheduled
// interview_date by date. Navigation from an event back to the job/match closes
// the loop with the rest of the tracker. No external calendar sync or reminders.

type AgendaRow = {
  id: string;
  job_id: string | null;
  match_id: string | null;
  status: string;
  interview_date: string | null;
  interview_stage: string | null;
  interview_notes: string | null;
  jobs: { company: string; title: string } | null;
};

// Server-rendered "today" so past dates can be de-emphasized and upcoming
// counted. A bare date string keeps the comparison in the helper tz-free.
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function InterviewAgenda({ applications }: { applications: readonly AgendaRow[] }) {
  const { groups, upcomingCount, isEmpty } = buildInterviewAgenda(applications, {
    today: todayIso(),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
          <CardTitle>Interview agenda</CardTitle>
        </div>
        <CardDescription>
          {isEmpty
            ? "Scheduled interviews appear here, grouped by date."
            : `${upcomingCount} upcoming ${upcomingCount === 1 ? "interview" : "interviews"} across your tracked roles.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            No interviews scheduled yet — add an interview date to a tracked application to
            see it on the agenda.
          </p>
        ) : (
          <ol className="flex flex-col gap-5">
            {groups.map((group) => (
              <li key={group.date} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      group.isPast ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {formatShortDate(group.date)}
                  </span>
                  {group.isToday ? <Badge variant="info">Today</Badge> : null}
                  {group.isPast ? <Badge variant="outline">Past</Badge> : null}
                </div>
                <ul className="flex flex-col gap-2">
                  {group.events.map((event) => (
                    <li
                      key={event.applicationId}
                      className="flex flex-col gap-1.5 rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{event.company}</span>
                        <span className="text-muted-foreground">{event.title}</span>
                        {event.stageLabel ? (
                          <Badge variant="secondary">{event.stageLabel}</Badge>
                        ) : null}
                        {event.isLearningTarget ? (
                          <Badge variant="warning">Learning Target</Badge>
                        ) : null}
                      </div>
                      {event.notes ? (
                        <p className="text-xs text-muted-foreground">{event.notes}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-3 text-xs">
                        {event.jobId ? (
                          <Link
                            className="font-medium underline underline-offset-4"
                            href={`/jobs/${event.jobId}`}
                          >
                            View job
                          </Link>
                        ) : null}
                        {event.matchId ? (
                          <Link
                            className="font-medium underline underline-offset-4"
                            href={`/matches/${event.matchId}`}
                          >
                            View match
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
