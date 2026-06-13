
import { MissingSkillsForm } from "@/components/forms/missing-skills-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, getMissingSkillsDetail } from "@/lib/data/server";
import { groupByImportance } from "@/lib/missing-skills-view.mjs";

type GapsPageProps = {
  params: Promise<{ matchId: string }>;
};

type ViewSkill = {
  skill: string;
  importance: string;
  gap_type: string;
  evidence_status: string;
  resume_evidence: string;
  job_requirement: string;
  why_it_matters: string;
  how_to_fix: string;
  suggested_project_task: string;
  interview_risk: string;
};

type ViewGroup = { key: string; label: string; items: ViewSkill[] };

const GAP_TYPE_LABEL: Record<string, string> = {
  true_gap: "True gap",
  wording_gap: "Wording gap",
  proof_gap: "Proof gap",
};

const EVIDENCE_LABEL: Record<string, string> = {
  no_evidence: "No evidence",
  weak_evidence: "Weak evidence",
  strong_evidence: "Strong evidence",
};

const IMPORTANCE_VARIANT: Record<string, "warning" | "info" | "secondary"> = {
  critical: "warning",
  medium: "info",
  nice_to_have: "secondary",
};

const EVIDENCE_VARIANT: Record<string, "destructive" | "warning" | "success"> = {
  no_evidence: "destructive",
  weak_evidence: "warning",
  strong_evidence: "success",
};

function SkillCard({ item }: { item: ViewSkill }) {
  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{item.skill}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{GAP_TYPE_LABEL[item.gap_type] ?? item.gap_type}</Badge>
          <Badge variant={EVIDENCE_VARIANT[item.evidence_status] ?? "outline"}>
            {EVIDENCE_LABEL[item.evidence_status] ?? item.evidence_status}
          </Badge>
        </div>
      </div>

      {item.why_it_matters ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.why_it_matters}</p>
      ) : null}

      {item.how_to_fix ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">How to fix:</span> {item.how_to_fix}
        </p>
      ) : null}

      {item.interview_risk ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">Interview risk:</span> {item.interview_risk}
        </p>
      ) : null}

      {item.suggested_project_task ? (
        <p className="mt-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">Suggested project:</span>{" "}
          {item.suggested_project_task}
        </p>
      ) : null}

      {item.resume_evidence ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">Resume evidence:</span> {item.resume_evidence}
        </p>
      ) : null}
    </li>
  );
}

export default async function GapsPage({ params }: GapsPageProps) {
  const { matchId } = await params;
  const { match, analysis } = await getMissingSkillsDetail(matchId);

  const groups = groupByImportance(analysis?.missing_skills_json) as ViewGroup[];
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const priorities = Array.isArray(analysis?.top_3_priority_gaps_json)
    ? (analysis?.top_3_priority_gaps_json as unknown[]).map(String).filter(Boolean)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Skill gap analysis</CardTitle>
            <CardDescription>
              {match.jobs?.company || "Unknown company"} -{" "}
              {match.jobs?.title || "Unknown role"} · {match.resumes?.title || "Resume"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>
              {analysis?.summary ||
                "This breaks down what is missing, why it matters, and how to fix it — grouped by how much this role needs each skill."}
            </p>
            {priorities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-foreground">Priority gaps:</span>
                {priorities.map((skill) => (
                  <Badge key={skill} variant="warning">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generator</CardTitle>
            <CardDescription>
              {analysis
                ? `Last analyzed ${formatShortDate(analysis.updated_at)}`
                : "Analyze gaps after the match report is generated."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MissingSkillsForm matchId={match.id} hasExisting={Boolean(analysis)} />
          </CardContent>
        </Card>
      </section>

      {total > 0 ? (
        <section className="grid gap-5">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <Card key={group.key}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant={IMPORTANCE_VARIANT[group.key] ?? "outline"}>
                      {group.label}
                    </Badge>
                    <CardTitle className="text-base">
                      {group.items.length} {group.items.length === 1 ? "gap" : "gaps"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-3">
                    {group.items.map((item, index) => (
                      <SkillCard key={`${item.skill}-${index}`} item={item} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No gap analysis yet</CardTitle>
            <CardDescription>
              Generate a match report first, then analyze skill gaps to see what to fix and how.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
