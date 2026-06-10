import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  LayoutTemplate,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { DraftCvBulletReviewForm } from "@/components/forms/draft-cv-bullet-review-form";
import { DraftCvExportButtons } from "@/components/forms/draft-cv-export-buttons";
import { DraftCvGenerateForm } from "@/components/forms/draft-cv-generate-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShortDate, getDraftCvDetail } from "@/lib/data/server";
import {
  buildDraftCvView,
  buildRenderingView,
  collectReviewBullets,
  draftStatusLabel,
  draftStatusVariant,
} from "@/lib/draft-cv-view.mjs";
import { serverEnv } from "@/lib/env";

type DraftCvPageProps = {
  params: Promise<{ matchId: string }>;
};

function slugify(parts: Array<string | null | undefined>): string {
  // The [^a-z0-9] pass below drops any remaining non-ASCII, so NFKD first lets
  // accented latin letters degrade to their base form rather than vanishing.
  const slug = parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "resume";
}

export default async function DraftCvPage({ params }: DraftCvPageProps) {
  const { matchId } = await params;
  const { match, draft, versions } = await getDraftCvDetail(matchId);

  const analyzed = match.apply_recommendation != null || match.analyzed_at != null;
  const company = match.jobs?.company || "Unknown company";
  const role = match.jobs?.title || "Unknown role";

  const view = draft ? buildDraftCvView(draft.cv_json) : null;
  const rendering = draft ? buildRenderingView(draft.rendering_json) : null;
  const review = draft ? collectReviewBullets(draft.cv_json) : { pending: [], excluded: [] };
  const strategy = (draft?.cv_strategy_json ?? {}) as {
    summary?: string;
    primary_positioning?: string;
    keywords_prioritized?: string[];
    keywords_excluded?: Array<{ keyword: string; reason: string }>;
  };
  const slug = slugify([view?.contact?.full_name, company, role]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link
        href={`/matches/${match.id}`}
        className={buttonVariants({ variant: "ghost", className: "w-fit" })}
      >
        <ArrowLeft data-icon="inline-start" />
        Match report
      </Link>

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-muted text-[oklch(0.43_0.10_164)] dark:text-brand">
                <FileText className="size-4" />
              </div>
              <div>
                <CardTitle>Draft CV</CardTitle>
                <CardDescription>
                  {company} - {role}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {draft ? (
              <>
                <Badge variant={draftStatusVariant(draft.status)}>
                  {draftStatusLabel(draft.status)}
                </Badge>
                <span>Version {draft.version}</span>
                {typeof draft.confidence_score === "number" ? (
                  <span>· Confidence {Math.round(draft.confidence_score * 100)}%</span>
                ) : null}
                {draft.provider ? <span>· {draft.provider}</span> : null}
              </>
            ) : (
              <span>
                A tailored, truth-guarded CV you can review and export as PDF or DOCX.
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generator</CardTitle>
            <CardDescription>
              {draft
                ? `Latest generated ${formatShortDate(draft.created_at)}`
                : analyzed
                  ? "Ready to generate"
                  : "Analyze this match first"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {analyzed ? (
              <DraftCvGenerateForm matchId={match.id} hasDraft={Boolean(draft)} />
            ) : (
              <Link
                href={`/matches/${match.id}`}
                className={buttonVariants({ variant: "default" })}
              >
                Generate match analysis
              </Link>
            )}
            {draft ? (
              <DraftCvExportButtons
                apiBaseUrl={serverEnv.NEXT_PUBLIC_API_BASE_URL ?? null}
                draftCvId={draft.id}
                fileSlug={slug}
                pendingReviewCount={review.pending.length}
                rendering={rendering}
              />
            ) : null}
          </CardContent>
        </Card>
      </section>

      {!draft ? (
        <Card>
          <CardContent className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {analyzed
              ? "Generate a draft CV to see the tailored preview, Truth Guard review, and export actions here."
              : "Run the match analysis on the report page, then return to generate a draft CV."}
          </CardContent>
        </Card>
      ) : null}

      {draft && view ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="size-4 text-brand" />
                Recommended format
              </CardTitle>
              <CardDescription>
                {rendering
                  ? `${rendering.recommendedPages} page${rendering.recommendedPages === 1 ? "" : "s"} · ${rendering.fontProfileLabel}`
                  : "This draft predates page recommendations."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {rendering ? (
                <>
                  {rendering.reason ? (
                    <p className="text-muted-foreground">{rendering.reason}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {rendering.recommendedPages} page{rendering.recommendedPages === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline">{rendering.fontProfileLabel}</Badge>
                    <Badge variant="outline">{rendering.densityLabel} density</Badge>
                  </div>
                  {rendering.strategy.length ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        How ApplyWise prioritized space
                      </span>
                      <ul className="ml-4 list-disc text-muted-foreground">
                        {rendering.strategy.map((item: string, index: number) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">
                  Regenerate this draft to get a page-count and font recommendation tailored to
                  your experience.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand" />
                CV strategy
              </CardTitle>
              <CardDescription>{strategy.summary || "Tailoring strategy for this role."}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {strategy.primary_positioning ? (
                <p className="text-muted-foreground">{strategy.primary_positioning}</p>
              ) : null}
              {strategy.keywords_prioritized?.length ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Prioritized keywords
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {strategy.keywords_prioritized.map((kw) => (
                      <Badge key={kw} variant="secondary">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {strategy.keywords_excluded?.length ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Excluded (unsupported)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {strategy.keywords_excluded.map((item) => (
                      <Badge key={item.keyword} variant="outline">
                        {item.keyword} · {item.reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {review.pending.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-warning" />
                  Truth Guard review ({review.pending.length})
                </CardTitle>
                <CardDescription>
                  These claims are plausible but unproven. Approve to include them in the export;
                  unreviewed items are excluded.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {review.pending.map((bullet) => (
                  <div key={bullet.id} className="rounded-lg border p-3">
                    <p className="text-sm">{bullet.text}</p>
                    {bullet.evidence ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Evidence: {bullet.evidence}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <DraftCvBulletReviewForm
                        matchId={match.id}
                        draftCvId={draft.id}
                        bulletId={bullet.id}
                        userAction="pending"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                CV preview
              </CardTitle>
              <CardDescription>
                Exactly what your PDF/DOCX export will contain. Excluded and unreviewed claims are
                not shown here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 text-sm leading-6">
              <div>
                <p className="text-base font-semibold">
                  {view.contact?.full_name || "Your name"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    view.contact?.email,
                    view.contact?.phone,
                    view.contact?.location,
                    view.contact?.linkedin_url,
                    view.contact?.github_url,
                    view.contact?.portfolio_url,
                  ]
                    .filter(Boolean)
                    .join("  |  ")}
                </p>
              </div>

              {view.professionalSummary ? (
                <PreviewSection title="Professional Summary">
                  <p>{view.professionalSummary}</p>
                </PreviewSection>
              ) : null}

              {view.skills.length ? (
                <PreviewSection title="Skills">
                  <ul className="flex flex-col gap-1">
                    {view.skills.map(
                      (group: { category: string; items: string[] }) => (
                        <li key={group.category}>
                          <span className="font-medium">{group.category}:</span>{" "}
                          {group.items.join(", ")}
                        </li>
                      )
                    )}
                  </ul>
                </PreviewSection>
              ) : null}

              {view.workExperience.some(
                (e: { bullets: string[] }) => e.bullets.length
              ) ? (
                <PreviewSection title="Work Experience">
                  {view.workExperience.map(
                    (
                      entry: {
                        company?: string;
                        title?: string;
                        start_date?: string;
                        end_date?: string;
                        bullets: string[];
                      },
                      index: number
                    ) => (
                      <ExperienceEntry key={index} entry={entry} />
                    )
                  )}
                </PreviewSection>
              ) : null}

              {view.projects.some((e: { bullets: string[] }) => e.bullets.length) ? (
                <PreviewSection title="Projects">
                  {view.projects.map(
                    (
                      entry: { name?: string; bullets: string[]; tech_stack?: string[] },
                      index: number
                    ) => (
                      <div key={index} className="flex flex-col gap-1">
                        <p className="font-medium">{entry.name}</p>
                        <ul className="ml-4 list-disc">
                          {entry.bullets.map((b: string, i: number) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  )}
                </PreviewSection>
              ) : null}

              {view.education.length ? (
                <PreviewSection title="Education">
                  <ul className="flex flex-col gap-1">
                    {view.education.map(
                      (
                        e: { school?: string; degree?: string; field?: string },
                        index: number
                      ) => (
                        <li key={index}>
                          {[e.school, e.degree, e.field].filter(Boolean).join(", ")}
                        </li>
                      )
                    )}
                  </ul>
                </PreviewSection>
              ) : null}
            </CardContent>
          </Card>

          {draft.quality_notes_json?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Quality notes</CardTitle>
                <CardDescription>Automated checks applied to this draft.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {draft.quality_notes_json.map((note, index) => (
                    <li key={index}>· {note.detail}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {versions.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Version history</CardTitle>
                <CardDescription>{versions.length} generated version(s).</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4">Version</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Provider</th>
                      <th className="py-2 pr-4">Confidence</th>
                      <th className="py-2 pr-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.id} className="border-t">
                        <td className="py-2 pr-4">v{v.version}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={draftStatusVariant(v.status)}>
                            {draftStatusLabel(v.status)}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">{v.provider ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {typeof v.confidence_score === "number"
                            ? `${Math.round(v.confidence_score * 100)}%`
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">{formatShortDate(v.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="border-b pb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ExperienceEntry({
  entry,
}: {
  entry: {
    company?: string;
    title?: string;
    start_date?: string;
    end_date?: string;
    bullets: string[];
  };
}) {
  const dates = [entry.start_date, entry.end_date].filter(Boolean).join(" – ");
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium">
        {[entry.title, entry.company].filter(Boolean).join(" — ")}
        {dates ? <span className="text-muted-foreground"> ({dates})</span> : null}
      </p>
      <ul className="ml-4 list-disc">
        {entry.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}
