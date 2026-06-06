import Link from "next/link";
import { ArrowUpRight, FileText, Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { quickActions, recentJobs, resumeSources } from "@/lib/app-data";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DashboardPage() {
  return (
    <AppShell active="Dashboard">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex max-w-2xl flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-normal">
                  Build a stronger AI Engineer application.
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Import a resume, paste a job description, then compare the evidence before
                  deciding whether to apply now or improve first.
                </p>
              </div>
              <Link href="/resumes/new" className={buttonVariants({ size: "lg" })}>
                <Upload data-icon="inline-start" />
                Add Resume
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                        <Icon className="size-4" />
                      </span>
                      {action.label}
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Apply Now or Improve First?</CardTitle>
              <CardDescription>Preview state before the first generated match.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Match", 74],
                  ["AI ready", 58],
                  ["ATS", 82],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <div className="text-xl font-semibold">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Recommendation</span>
                  <Badge variant="secondary">Improve first</Badge>
                </div>
                <Progress value={58} />
                <p className="text-sm leading-6 text-muted-foreground">
                  Backend experience is visible, but RAG, vector databases, and AI evaluation
                  still need stronger proof.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Primary resume</CardTitle>
              <CardDescription>Supported sources for the first import flow.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                  <FileText className="size-4" />
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <div>
                    <p className="text-sm font-medium">No resume imported yet</p>
                    <p className="text-sm text-muted-foreground">
                      Paste text or upload a PDF, DOCX, image, Markdown, or plain text resume.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resumeSources.map((source) => (
                      <Badge key={source} variant="outline">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <Link href="/resumes/new" className={buttonVariants({ variant: "outline" })}>
                Open resume import
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI workflow status</CardTitle>
              <CardDescription>Backend services planned for the next slice.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {["Docling import", "Resume parser", "JD parser", "Match analyzer"].map(
                (item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">{item}</span>
                    <Badge variant={index === 0 ? "secondary" : "outline"}>
                      {index === 0 ? "scaffolded" : "planned"}
                    </Badge>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <CardDescription>Sample tracker data for the Period 1 shell.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={`${job.company}-${job.role}`}>
                    <TableCell className="font-medium">{job.company}</TableCell>
                    <TableCell>{job.role}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.status}</Badge>
                    </TableCell>
                    <TableCell>{job.contact}</TableCell>
                    <TableCell className="text-right">{job.match}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
