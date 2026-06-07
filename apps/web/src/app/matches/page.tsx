import Link from "next/link";

import { AppShell } from "@/components/app-shell";
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
import { formatShortDate, getMatchWorkspaceData } from "@/lib/data/server";

export default async function MatchesPage() {
  const { appUser, profile, matches } = await getMatchWorkspaceData();

  return (
    <AppShell
      active="Matches"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Matches</h1>
            <p className="text-sm text-muted-foreground">
              Resume-to-job analysis reports saved under your account.
            </p>
          </div>
          <Link href="/matches/new" className={buttonVariants({ size: "lg" })}>
            Generate Match
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Saved match analyses</CardTitle>
            <CardDescription>
              {matches.length > 0
                ? "Latest generated reports."
                : "Generated analyses appear here after you compare a resume and job."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Resume</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        <Link href={`/matches/${match.id}`} className="hover:underline">
                          {match.jobs?.company || "Unknown company"} -{" "}
                          {match.jobs?.title || "Unknown role"}
                        </Link>
                      </TableCell>
                      <TableCell>{match.resumes?.title || "Unknown resume"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{match.overall_score}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatShortDate(match.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Generate a match after saving a resume and job description.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
