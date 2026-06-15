import Link from "next/link";
import {
  Download,
  FileText,
  LayoutTemplate,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { DraftCvCoveragePanel } from "@/components/draft-cv-coverage-panel";
import { DraftCvPdfPreview } from "@/components/draft-cv/pdf-preview";
import { VersionDiffPanel } from "@/components/draft-cv/version-diff-panel";
import { DraftCvBulletEditor } from "@/components/forms/draft-cv-bullet-editor";
import { DraftCvBulletReviewForm } from "@/components/forms/draft-cv-bullet-review-form";
import { DraftCvExportButtons } from "@/components/forms/draft-cv-export-buttons";
import { DraftCvGenerateForm } from "@/components/forms/draft-cv-generate-form";
import { DraftCvPreservationCard } from "@/components/forms/draft-cv-preservation-card";
import { TailoringStepper } from "@/components/tailoring-stepper";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetailsSection } from "@/components/ui/details-section";
import { formatShortDate, getDraftCvDetail } from "@/lib/data/server";
import {
  coverageReport,
  extractJobKeywords,
  renderableCvTexts,
} from "@/lib/coverage-view.mjs";
import {
  buildDraftCvView,
  buildRenderingView,
  collectFeedbackTrace,
  collectPreservationConflicts,
  collectReviewBullets,
  draftStatusLabel,
  draftStatusVariant,
  hasRenderableContent,
  staleFeedbackCount,
} from "@/lib/draft-cv-view.mjs";
import { serverEnv } from "@/lib/env";

type DraftCvPageProps = {
  params: Promise<{ matchId: string }>;
};

type PreviewBullet = {
  id: string | null;
  text: string;
  userEdited: boolean;
  polished: boolean;
  originalText: string;
  sourceFeedbackId: string | null;
  pendingEdit: {
    userText: string;
    polishedText: string;
    truthGuardStatus: string;
    evidenceQuestion: string | null;
  } | null;
};

function slugify(parts: Array<string | null | undefined>): string {
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
  const { match, draft, versions, suggestions } = await getDraftCvDetail(matchId);

  const analyzed = match.apply_recommendation != null || match.analyzed_at != null;
  const company = match.jobs?.company || "Unknown company";
  const role = match.jobs?.title || "Unknown role";

  const view = draft ? buildDraftCvView(draft.cv_json) : null;
  const hasContent = view ? hasRenderableContent(view) : false;
  const rendering = draft ? buildRenderingView(draft.rendering_json) : null;
  const review = draft ? collectReviewBullets(draft.cv_json) : { pending: [], excluded: [] };
  const respondedCount = suggestions.filter(
    (row) => (row.user_action ?? "pending") !== "pending"
  ).length;
  const approvedCount = suggestions.filter((row) => row.user_action === "accepted").length;
  const staleCount = draft ? staleFeedbackCount(draft.created_at, suggestions) : 0;
  const feedbackTrace = draft ? collectFeedbackTrace(draft.cv_json, suggestions) : [];
  const preservationConflicts = draft ? collectPreservationConflicts(draft.cv_json) : [];
  const apiBaseUrl = serverEnv.NEXT_PUBLIC_API_BASE_URL ?? null;

  const strategy = (draft?.cv_strategy_json ?? {}) as {
    summary?: string;
    primary_positioning?: string;
    keywords_prioritized?: string[];
    keywords_excluded?: Array<{ keyword: string; reason: string }>;
  };
  const slug = slugify([view?.contact?.full_name, company, role]);

  const coverage =
    draft && view
      ? coverageReport({
          keywords: extractJobKeywords(match.jobs?.structured_json),
          baseText: match.resumes?.raw_text ?? "",
          tailoredTexts: renderableCvTexts(view),
          excludedKeywords: (strategy.keywords_excluded ?? []).map((item) => item.keyword),
        })
      : null;

  const hasStrategyDetail = Boolean(
    rendering ||
      strategy.summary ||
      strategy.primary_positioning ||
      strategy.keywords_prioritized?.length ||
      strategy.keywords_excluded?.length
  );
  const blockerCount = preservationConflicts.length + review.pending.length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <TailoringStepper
        matchId={match.id}
        suggestionCount={suggestions.length}
        respondedCount={respondedCount}
        hasDraft={Boolean(draft)}
        draftStatus={draft?.status ?? null}
      />

      {/* Hero: the deliverable + the action */}
      <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-brand" />
              Tailored CV
            </CardTitle>
            <CardDescription>
              {company} · {role}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {draft ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={draftStatusVariant(draft.status)}>
                  {draftStatusLabel(draft.status)}
                </Badge>
                <span>Version {draft.version}</span>
                {typeof draft.confidence_score === "number" ? (
                  <span>· {Math.round(draft.confidence_score * 100)}% confidence</span>
                ) : null}
                {draft.provider ? <span>· {draft.provider}</span> : null}
                <span>· Generated {formatShortDate(draft.created_at)}</span>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                A tailored, truth-guarded CV you can review and export as PDF, DOCX, or Markdown.
              </p>
            )}

            {analyzed ? (
              <>
                <DraftCvGenerateForm matchId={match.id} hasDraft={Boolean(draft)} />
                {/* Honesty notes — only what applies to this draft (US-061) */}
                {approvedCount === 0 ? (
                  <p className="text-xs leading-5 text-warning-foreground">
                    No approved responses yet — this CV is tailored from your resume and the job
                    only.{" "}
                    <Link
                      href={`/matches/${match.id}/resume-suggestions`}
                      className="font-medium underline underline-offset-2"
                    >
                      Review suggestions first
                    </Link>{" "}
                    for a stronger result.
                  </p>
                ) : draft?.provider !== "deterministic" ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {approvedCount} approved response{approvedCount === 1 ? "" : "s"} shape
                    {approvedCount === 1 ? "s" : ""} this CV.
                  </p>
                ) : null}
                {staleCount > 0 ? (
                  <p className="text-xs leading-5 text-warning-foreground">
                    {staleCount} response{staleCount === 1 ? "" : "s"} changed after this CV was
                    generated and {staleCount === 1 ? "is" : "are"} not in it yet — regenerate to
                    weave your latest feedback in.
                  </p>
                ) : null}
                {draft?.provider === "deterministic" ? (
                  <p className="text-xs leading-5 text-warning-foreground">
                    This version came from the offline fallback (the AI model was unavailable). It
                    copies your profile and does not weave feedback — regenerate once the model is
                    back.
                  </p>
                ) : null}
              </>
            ) : (
              <Link href={`/matches/${match.id}`} className={buttonVariants()}>
                Generate match analysis
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Export panel */}
        <Card className={draft && hasContent ? "ring-brand/30" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="size-4 text-brand" />
              Export
            </CardTitle>
            <CardDescription>
              {draft && hasContent ? "PDF, DOCX, or Markdown" : "Ready once a draft is generated"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {draft && hasContent ? (
              <DraftCvExportButtons
                apiBaseUrl={apiBaseUrl}
                draftCvId={draft.id}
                fileSlug={slug}
                pendingReviewCount={review.pending.length}
                rendering={rendering}
              />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Generate a draft CV to enable export.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Empty / contentless states */}
      {!draft ? (
        <Card>
          <CardContent className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {analyzed
              ? "Generate a draft CV to see the tailored preview, Truth Guard review, and export actions here."
              : "Run the match analysis on the report page, then return to generate a draft CV."}
          </CardContent>
        </Card>
      ) : null}

      {draft && !hasContent ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-warning" />
              Nothing to review yet
            </CardTitle>
            <CardDescription>
              This draft was generated but has no content to preview or export.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            {draft.provider === "deterministic"
              ? "The AI model was unavailable, so this used the offline fallback — and your structured profile is empty, so it had nothing to tailor. Your résumé is saved; regenerate the draft CV (above) once the model is available."
              : "This version came back empty. Regenerate the draft CV (above) to try again."}
          </CardContent>
        </Card>
      ) : null}

      {draft && view ? (
        <>
          {/* Blockers — gate a complete export, so they stay visible */}
          {blockerCount > 0 ? (
            <section className="flex flex-col gap-4">
              {preservationConflicts.length ? (
                <Card className="ring-warning/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldAlert className="size-4 text-warning" />
                      Confirmed bullets need a decision ({preservationConflicts.length})
                    </CardTitle>
                    <CardDescription>
                      Regeneration restructured the entry these confirmed bullets belonged to.
                      Decide per bullet — nothing is dropped silently.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DraftCvPreservationCard
                      apiBaseUrl={apiBaseUrl}
                      draftCvId={draft.id}
                      conflicts={preservationConflicts}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {review.pending.length ? (
                <Card className="ring-warning/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldAlert className="size-4 text-warning" />
                      Truth Guard review ({review.pending.length})
                    </CardTitle>
                    <CardDescription>
                      These claims are plausible but unproven. Approve to include them in the
                      export; unreviewed items are excluded.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {review.pending.map((bullet) => (
                      <div key={bullet.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm">{bullet.text}</p>
                          <Badge variant={bullet.sourceFeedbackId ? "secondary" : "outline"}>
                            {bullet.sourceFeedbackId ? "From your feedback" : "AI suggested"}
                          </Badge>
                        </div>
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
            </section>
          ) : null}

          {/* The deliverable — CV preview */}
          {hasContent ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-success" />
                  CV preview
                </CardTitle>
                <CardDescription>
                  Exactly what your export will contain. Excluded and unreviewed claims are not
                  shown. Click any bullet to polish it.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 text-sm leading-6">
                <div>
                  <p className="text-base font-semibold">{view.contact?.full_name || "Your name"}</p>
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
                      {view.skills.map((group: { category: string; items: string[] }) => (
                        <li key={group.category}>
                          <span className="font-medium">{group.category}:</span>{" "}
                          {group.items.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </PreviewSection>
                ) : null}

                {view.workExperience.some((e: { bullets: PreviewBullet[] }) => e.bullets.length) ? (
                  <PreviewSection title="Work Experience">
                    {view.workExperience.map(
                      (
                        entry: {
                          company?: string;
                          title?: string;
                          start_date?: string;
                          end_date?: string;
                          bullets: PreviewBullet[];
                        },
                        index: number
                      ) => (
                        <ExperienceEntry
                          key={index}
                          entry={entry}
                          apiBaseUrl={apiBaseUrl}
                          draftCvId={draft.id}
                        />
                      )
                    )}
                  </PreviewSection>
                ) : null}

                {view.projects.some((e: { bullets: PreviewBullet[] }) => e.bullets.length) ? (
                  <PreviewSection title="Projects">
                    {view.projects.map(
                      (
                        entry: { name?: string; bullets: PreviewBullet[]; tech_stack?: string[] },
                        index: number
                      ) => (
                        <div key={index} className="flex flex-col gap-1">
                          <p className="font-medium">{entry.name}</p>
                          <ul className="ml-4 list-disc">
                            {entry.bullets.map((b: PreviewBullet) => (
                              <li key={b.id ?? b.text}>
                                <DraftCvBulletEditor
                                  apiBaseUrl={apiBaseUrl}
                                  draftCvId={draft.id}
                                  bullet={b}
                                />
                              </li>
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
                        (e: { school?: string; degree?: string; field?: string }, index: number) => (
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
          ) : null}

          {/* Tailoring details — secondary evidence & mechanics, collapsed by default */}
          {hasStrategyDetail ||
          coverage ||
          feedbackTrace.length ||
          hasContent ||
          draft.quality_notes_json?.length ||
          versions.length ? (
            <div className="flex flex-col gap-3">
              <h2 className="px-1 text-sm font-semibold text-muted-foreground">Tailoring details</h2>

              {hasStrategyDetail ? (
                <DetailsSection
                  summary={
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-4 text-brand" />
                      Strategy &amp; recommended format
                    </span>
                  }
                >
                  <div className="flex flex-col gap-4 text-sm">
                    {rendering ? (
                      <div className="flex flex-col gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <LayoutTemplate className="size-3.5" />
                          Recommended format
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {rendering.recommendedPages} page
                            {rendering.recommendedPages === 1 ? "" : "s"}
                          </Badge>
                          <Badge variant="outline">{rendering.fontProfileLabel}</Badge>
                          <Badge variant="outline">{rendering.densityLabel} density</Badge>
                        </div>
                        {rendering.reason ? (
                          <p className="text-muted-foreground">{rendering.reason}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {strategy.summary || strategy.primary_positioning ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Positioning
                        </span>
                        {strategy.summary ? <p>{strategy.summary}</p> : null}
                        {strategy.primary_positioning ? (
                          <p className="text-muted-foreground">{strategy.primary_positioning}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {strategy.keywords_prioritized?.length ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                  </div>
                </DetailsSection>
              ) : null}

              {coverage ? (
                <DetailsSection
                  summary={
                    <span className="flex items-center gap-2">
                      <ListChecks className="size-4 text-brand" />
                      Tailoring coverage
                    </span>
                  }
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    How many of the job&apos;s keywords your exportable CV covers — tailoring
                    progress, not your match score.
                  </p>
                  <DraftCvCoveragePanel report={coverage} bare />
                </DetailsSection>
              ) : null}

              {feedbackTrace.length ? (
                <DetailsSection
                  summary={
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-4 text-muted-foreground" />
                      From your feedback ({feedbackTrace.length})
                    </span>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                      Each row pairs your approved feedback with the bullet it produced — check the
                      information survived the rewording (your information, the CV&apos;s tone).
                    </p>
                    {feedbackTrace.map(
                      (
                        row: {
                          bulletId: string | null;
                          bulletText: string;
                          feedbackText: string;
                          userEdited: boolean;
                          renderable: boolean;
                        },
                        index: number
                      ) => (
                        <div
                          key={row.bulletId ?? index}
                          className="grid gap-2 rounded-lg border p-3 md:grid-cols-2"
                        >
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Your feedback{row.userEdited ? " (edited by you)" : ""}
                            </p>
                            <p className="mt-1 text-sm leading-6">{row.feedbackText}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Woven into the CV{row.renderable ? "" : " (awaiting review)"}
                            </p>
                            <p className="mt-1 text-sm leading-6">{row.bulletText}</p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </DetailsSection>
              ) : null}

              {hasContent ? (
                <DetailsSection
                  summary={
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 text-brand" />
                      Rendered PDF
                    </span>
                  }
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    The exact PDF your export will produce. Rendering it here does not export or
                    change the draft.
                  </p>
                  <DraftCvPdfPreview apiBaseUrl={apiBaseUrl} draftCvId={draft.id} />
                </DetailsSection>
              ) : null}

              {draft.quality_notes_json?.length ? (
                <DetailsSection
                  summary={
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                      Quality notes ({draft.quality_notes_json.length})
                    </span>
                  }
                >
                  <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    {draft.quality_notes_json.map((note, index) => (
                      <li key={index}>· {note.detail}</li>
                    ))}
                  </ul>
                </DetailsSection>
              ) : null}

              {versions.length ? (
                <DetailsSection
                  summary={
                    <span className="flex items-center gap-2">
                      <ListChecks className="size-4 text-muted-foreground" />
                      Version history ({versions.length})
                    </span>
                  }
                >
                  <div className="flex flex-col gap-4">
                    {versions.length >= 2 ? <VersionDiffPanel versions={versions} bare /> : null}
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2">Version</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Provider</th>
                            <th className="px-4 py-2">Confidence</th>
                            <th className="px-4 py-2">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {versions.map((v) => (
                            <tr key={v.id} className="border-t">
                              <td className="px-4 py-2">v{v.version}</td>
                              <td className="px-4 py-2">
                                <Badge variant={draftStatusVariant(v.status)}>
                                  {draftStatusLabel(v.status)}
                                </Badge>
                              </td>
                              <td className="px-4 py-2">{v.provider ?? "—"}</td>
                              <td className="px-4 py-2">
                                {typeof v.confidence_score === "number"
                                  ? `${Math.round(v.confidence_score * 100)}%`
                                  : "—"}
                              </td>
                              <td className="px-4 py-2">{formatShortDate(v.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </DetailsSection>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
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
  apiBaseUrl,
  draftCvId,
}: {
  entry: {
    company?: string;
    title?: string;
    start_date?: string;
    end_date?: string;
    bullets: PreviewBullet[];
  };
  apiBaseUrl: string | null;
  draftCvId: string;
}) {
  const dates = [entry.start_date, entry.end_date].filter(Boolean).join(" – ");
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium">
        {[entry.title, entry.company].filter(Boolean).join(" — ")}
        {dates ? <span className="text-muted-foreground"> ({dates})</span> : null}
      </p>
      <ul className="ml-4 list-disc">
        {entry.bullets.map((b) => (
          <li key={b.id ?? b.text}>
            <DraftCvBulletEditor apiBaseUrl={apiBaseUrl} draftCvId={draftCvId} bullet={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}
