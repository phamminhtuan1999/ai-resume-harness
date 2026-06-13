import Link from "next/link";
import { Coins, Database, UserRound } from "lucide-react";

import { DangerZoneCard } from "@/components/settings/danger-zone-card";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCreditBalanceForUser } from "@/lib/billing-ledger";
import { getTrackerData, getWorkspaceData } from "@/lib/data/server";

export default async function SettingsPage() {
  const [{ appUser, profile, resumes, jobs, matches }, { applications }] =
    await Promise.all([getWorkspaceData(), getTrackerData()]);
  const creditBalance = profile?.id
    ? await getCreditBalanceForUser(profile.id)
    : 0;

  const dataRows = [
    ["Profiles", profile ? 1 : 0],
    ["Resumes", resumes.length],
    ["Jobs", jobs.length],
    ["Matches", matches.length],
    ["Applications", applications.length],
  ] as const;

  const totalRecords = dataRows.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        description="Review account identity and data controls for the protected workspace."
        title="Settings"
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" />
              Account
            </CardTitle>
            <CardDescription>
              Clerk identity mapped to the ApplyWise profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="font-medium">Name</p>
                <p className="text-muted-foreground">
                  {profile?.full_name || appUser?.fullName || "Not provided"}
                </p>
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="break-all text-muted-foreground">
                  {profile?.email || appUser?.email}
                </p>
              </div>
              <div>
                <p className="font-medium">Current role</p>
                <p className="text-muted-foreground">
                  {profile?.current_role || "Not provided"}
                </p>
              </div>
              <div>
                <p className="font-medium">Target role</p>
                <p className="text-muted-foreground">
                  {profile?.target_role || "Not provided"}
                </p>
              </div>
            </div>
            <Separator />
            <Link
              href="/profile"
              className={buttonVariants({
                variant: "outline",
                className: "w-fit",
              })}
            >
              Manage profile
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4" />
              Workspace records
            </CardTitle>
            <CardDescription>
              Current saved data under this account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dataRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-sm text-muted-foreground">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="size-4" />
            Credits
          </CardTitle>
          <CardDescription>
            Credit balance is derived from posted purchase and spend ledger
            rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold">{creditBalance}</p>
            <p className="text-sm text-muted-foreground">available credits</p>
          </div>
          <Link href="/pricing" className={buttonVariants()}>
            Buy credits
          </Link>
        </CardContent>
      </Card>

      <DangerZoneCard recordCount={totalRecords} />
    </div>
  );
}
