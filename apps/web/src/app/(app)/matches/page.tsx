import Link from "next/link";
import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
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
import { formatShortDate, getMatchWorkspaceData } from "@/lib/data/server";

export default async function MatchesPage() {
  const { matches } = await getMatchWorkspaceData();

  return (
    
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <PageHeader
          actions={
          <Link href="/matches/new" className={buttonVariants({ size: "lg" })}>
            Generate match
          </Link>
          }
          description="Review resume-to-job analysis reports saved under your account."
          title="Matches"
        />

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
              <EmptyState
                variant="create"
                action={
                  <Link href="/matches/new" className={buttonVariants({ variant: "outline" })}>
                    Generate match
                  </Link>
                }
                description="Generate a match after saving a resume and job description."
                icon={ListChecks}
                title="No saved matches"
              />
            )}
          </CardContent>
        </Card>
      </div>
  );
}
