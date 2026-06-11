import Link from "next/link";

import {
  ExperienceSnapshotCard,
  SkillsCard,
  type CandidateView,
} from "@/components/profile/candidate-profile-section";
import { ProfileIdentityCard } from "@/components/profile/profile-identity-card";
import { ProfileForm } from "@/components/forms/profile-form";
import { ProfileRecheckBanner } from "@/components/profile/profile-recheck-banner";
import { PageHeader } from "@/components/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { getProfilePageData } from "@/lib/data/server";
import {
  buildCandidateView,
  displayName,
  profileCompleteness,
  workspaceSnapshot,
} from "@/lib/profile-view.mjs";
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
  const [{ profile, candidateProfile, counts }, { recheck }] = await Promise.all([
    getProfilePageData(),
    searchParams,
  ]);

  const candidate = buildCandidateView(candidateProfile) as CandidateView | null;
  const completeness = profileCompleteness(profile);
  const snapshot = workspaceSnapshot(counts);
  const hasBackground =
    candidate &&
    (candidate.summary ||
      candidate.experience.length ||
      candidate.education.length ||
      candidate.certifications.length);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        description="Tune analysis toward AI-focused engineering roles with your current background and target role."
        title="Career profile"
      />
      {recheck ? <ProfileRecheckBanner matchId={recheck} /> : null}
      <SetupNotice />

      <ProfileIdentityCard
        name={displayName(profile, candidate)}
        email={profile?.contact_email || profile?.email || null}
        phone={profile?.phone || candidate?.phone || null}
        currentRole={profile?.current_role ?? null}
        targetRole={profile?.target_role ?? null}
        yearsOfExperience={profile?.years_of_experience ?? null}
        location={profile?.location_preference ?? candidate?.location ?? null}
        links={candidate?.links ?? []}
        completeness={completeness}
      />

      <section className="grid items-start gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Targeting &amp; contact</CardTitle>
            <CardDescription>
              Saved values for role-specific analysis, plus the contact details used on
              generated CVs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <SkillsCard candidate={candidate} />
        </div>
      </section>

      {hasBackground ? <ExperienceSnapshotCard candidate={candidate} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>The materials your analyses draw from.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {snapshot.map((tile) => (
              <Link
                key={tile.key}
                href={tile.href}
                className="rounded-lg border p-3 transition-colors hover:bg-secondary/50"
              >
                <div className="text-xl font-semibold">{tile.count}</div>
                <div className="text-xs text-muted-foreground">{tile.label}</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
