import Link from "next/link";
import { Lock } from "lucide-react";

import { GenerateAnywayAction } from "@/components/matches/generate-anyway-action";
import { LearningTargetAction } from "@/components/matches/learning-target-action";
import { NextActionTrackerForm } from "@/components/matches/next-action-tracker-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailsSection } from "@/components/ui/details-section";
import {
  actionCreditCost,
  actionHref,
  actionScope,
  groupActions,
  materialWarning,
  needsConfirm,
} from "@/lib/next-actions-view.mjs";
import type { AnalysisPackage } from "@/lib/data/server";

type NextActionsPanelProps = {
  pkg: AnalysisPackage;
  matchId: string;
  billingEnforced?: boolean;
};

type ActionContext = {
  matchId: string;
  jobId: string | null;
  jobUrl: string | null;
  materialReadiness: AnalysisPackage["material_readiness"];
  missingSkills: string[];
  billingEnforced: boolean;
};

// The upfront price chip on paid actions (decision 0020): rendered only when
// billing is actually enforced, so unconfigured dev stays free of cost noise.
function CostChip({ credits }: { credits: number }) {
  return (
    <span className="ml-auto pl-3 text-xs font-normal opacity-75 tabular-nums">
      {credits} {credits === 1 ? "credit" : "credits"}
    </span>
  );
}

type NextAction = AnalysisPackage["next_actions"][number];

function ActionItem({
  action,
  ctx,
  tier,
}: {
  action: NextAction;
  ctx: ActionContext;
  tier: "primary" | "secondary" | "advanced";
}) {
  const { type, label, reason, state } = action;
  const emphasize = tier === "primary";

  // Gated actions render locked-in-place with an inline reason — stable
  // geography, no tier-teleporting (decision 0015 §4).
  if (state === "locked") {
    return (
      <div className="rounded-lg border border-dashed p-3">
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lock className="size-4" />
          {label}
        </span>
        {reason ? <p className="mt-1 text-sm text-muted-foreground">{reason}</p> : null}
      </div>
    );
  }

  const scope = actionScope(type);
  const credits = ctx.billingEnforced ? actionCreditCost(type) : null;

  // Tracker mutations (Save to Tracker / Keep for reference / Save as Learning
  // Target) render as forms posting to server actions.
  if (scope === "tracker") {
    if (!ctx.jobId) {
      return null;
    }
    // Learning Target has its own confirm-before-demote flow (US-052).
    if (type === "save_learning_target") {
      return <LearningTargetAction jobId={ctx.jobId} matchId={ctx.matchId} label={label} />;
    }
    return (
      <NextActionTrackerForm
        jobId={ctx.jobId}
        matchId={ctx.matchId}
        label={label}
        kind={type === "save_reference" ? "reference" : "save"}
      />
    );
  }

  const href = actionHref(type, ctx.matchId, ctx.jobUrl);

  // Material guardrail: weak readiness requires an explicit warned confirm
  // before reaching the (unchanged) generation surface.
  if (href && needsConfirm(type, ctx.materialReadiness)) {
    return (
      <GenerateAnywayAction
        href={href}
        label={label}
        warning={materialWarning(ctx.missingSkills)}
        credits={credits}
      />
    );
  }

  // Unknown / unroutable type — render inert so it never silently disappears.
  if (!href) {
    return (
      <Button variant="outline" disabled className="w-full justify-start">
        {label}
      </Button>
    );
  }

  const className = buttonVariants({
    variant: emphasize ? "default" : "outline",
    className: "w-full justify-start",
  });

  if (scope === "external") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
      {credits ? <CostChip credits={credits} /> : null}
    </Link>
  );
}

function ActionGroup({
  actions,
  ctx,
  tier,
}: {
  actions: NextAction[];
  ctx: ActionContext;
  tier: "primary" | "secondary" | "advanced";
}) {
  if (actions.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-2">
      {actions.map((action, index) => (
        <ActionItem key={`${tier}-${action.type}-${index}`} action={action} ctx={ctx} tier={tier} />
      ))}
    </div>
  );
}

export function NextActionsPanel({ pkg, matchId, billingEnforced = false }: NextActionsPanelProps) {
  const groups = groupActions(pkg.next_actions);
  const ctx: ActionContext = {
    matchId,
    jobId: pkg.job.id,
    jobUrl: pkg.job.job_url,
    materialReadiness: pkg.material_readiness,
    missingSkills: pkg.evidence.missing,
    billingEnforced,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="contents">Recommended next actions</h2>
        </CardTitle>
        <CardDescription>What to do about this role, in priority order.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActionGroup actions={groups.primary} ctx={ctx} tier="primary" />

        {groups.secondary.length > 0 ? (
          <div className="flex flex-col gap-2 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">Also useful</p>
            <ActionGroup actions={groups.secondary} ctx={ctx} tier="secondary" />
          </div>
        ) : null}

        {groups.advanced.length > 0 ? (
          <DetailsSection variant="ghost" summary="Advanced actions" className="border-t pt-3">
            <ActionGroup actions={groups.advanced} ctx={ctx} tier="advanced" />
          </DetailsSection>
        ) : null}
      </CardContent>
    </Card>
  );
}
