import Link from "next/link";
import { Award, FileText, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SkillGroup = { key: string; label: string; items: string[] };

type ExperienceEntry = {
  title: string;
  company: string;
  location: string;
  dates: string;
  highlight: string;
};

type EducationEntry = { school: string; line: string; dates: string };

type CertificationEntry = { name: string; issuer: string; date: string };

// Mirrors buildCandidateView's return shape (src/lib/profile-view.mjs).
export type CandidateView = {
  name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  summary: string;
  background: string;
  links: { key: string; label: string; href: string }[];
  skillGroups: SkillGroup[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
};

export function SkillsCard({ candidate }: { candidate: CandidateView | null }) {
  if (!candidate || candidate.skillGroups.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Technical skills</CardTitle>
          <CardDescription>
            Skills appear here once a resume is imported and parsed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 rounded-lg text-sm text-muted-foreground">
          <p>No imported skill profile yet.</p>
          <Link href="/resumes" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <FileText data-icon="inline-start" />
            Import a resume
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Technical skills</CardTitle>
        <CardDescription>Imported from your resume; used as analysis evidence.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        {candidate.skillGroups.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ExperienceSnapshotCard({ candidate }: { candidate: CandidateView }) {
  const hasCredentials = candidate.education.length > 0 || candidate.certifications.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background</CardTitle>
        <CardDescription>
          The imported history your analyses and drafts draw from.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-5">
        <div className="flex flex-col gap-4 md:col-span-3">
          {candidate.summary ? (
            <p className="text-sm leading-6 text-muted-foreground">{candidate.summary}</p>
          ) : null}
          {candidate.experience.length ? (
            <ul className="flex flex-col divide-y">
              {candidate.experience.map((entry) => (
                <li
                  key={`${entry.title}-${entry.company}-${entry.dates}`}
                  className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium">
                      {entry.title}
                      {entry.company ? (
                        <span className="text-muted-foreground"> at {entry.company}</span>
                      ) : null}
                    </p>
                    {entry.dates ? (
                      <span className="text-xs text-muted-foreground">{entry.dates}</span>
                    ) : null}
                  </div>
                  {entry.highlight ? (
                    <p className="line-clamp-1 text-sm text-muted-foreground">{entry.highlight}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No work history was parsed yet.</p>
          )}
        </div>

        {hasCredentials ? (
          <div className="flex flex-col gap-4 md:col-span-2">
            {candidate.education.length ? (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <GraduationCap aria-hidden className="size-3.5" />
                  Education
                </p>
                <ul className="mt-1.5 flex flex-col gap-2">
                  {candidate.education.map((entry) => (
                    <li key={entry.school} className="text-sm">
                      <span className="font-medium">{entry.school}</span>
                      {entry.line ? (
                        <span className="text-muted-foreground"> {entry.line}</span>
                      ) : null}
                      {entry.dates ? (
                        <span className="text-muted-foreground"> ({entry.dates})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {candidate.certifications.length ? (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Award aria-hidden className="size-3.5" />
                  Certifications
                </p>
                <ul className="mt-1.5 flex flex-col gap-2">
                  {candidate.certifications.map((entry) => (
                    <li key={entry.name} className="text-sm">
                      <span className="font-medium">{entry.name}</span>
                      {entry.issuer ? (
                        <span className="text-muted-foreground"> {entry.issuer}</span>
                      ) : null}
                      {entry.date ? (
                        <span className="text-muted-foreground"> ({entry.date})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
