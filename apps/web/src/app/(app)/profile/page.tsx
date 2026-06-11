import { ProfileForm } from "@/components/forms/profile-form";
import { ProfileRecheckBanner } from "@/components/profile/profile-recheck-banner";
import { PageHeader } from "@/components/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { getWorkspaceData } from "@/lib/data/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProfilePageProps = {
  searchParams: Promise<{ recheck?: string }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [{ profile }, { recheck }] = await Promise.all([getWorkspaceData(), searchParams]);

  return (

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <PageHeader
          description="Tune analysis toward AI-focused engineering roles with your current background and target role."
          title="Career profile"
        />
        {recheck ? <ProfileRecheckBanner matchId={recheck} /> : null}
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
  );
}
