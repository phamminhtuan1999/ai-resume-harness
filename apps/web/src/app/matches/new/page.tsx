import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MatchForm } from "@/components/forms/match-form";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMatchWorkspaceData } from "@/lib/data/server";

export default async function NewMatchPage() {
  const { appUser, profile, resumes, jobs } = await getMatchWorkspaceData();

  return (
    <AppShell
      active="Matches"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <PageHeader
          actions={
            <Link href="/matches" className={buttonVariants({ variant: "ghost" })}>
              <ArrowLeft data-icon="inline-start" />
              Matches
            </Link>
          }
          description="Compare canonical resume content against a saved job description."
          title="Generate match analysis"
        />

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Select the resume and job to compare.</CardDescription>
          </CardHeader>
          <CardContent>
            <MatchForm resumes={resumes} jobs={jobs} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
