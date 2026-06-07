import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/forms/profile-form";
import { SetupNotice } from "@/components/setup-notice";
import { getWorkspaceData } from "@/lib/data/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProfilePage() {
  const { appUser, profile } = await getWorkspaceData();

  return (
    <AppShell
      active="Settings"
      userName={profile?.full_name || appUser?.fullName}
      userTarget={profile?.target_role}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Career profile</h1>
          <p className="text-sm text-muted-foreground">
            This profile will tune analysis toward AI-focused engineering roles.
          </p>
        </div>
        <SetupNotice />
        <Card>
          <CardHeader>
            <CardTitle>Targeting</CardTitle>
            <CardDescription>Saved profile values for role-specific analysis.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
