"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Pencil, RotateCcw, ShieldAlert, Sparkles, X } from "lucide-react";

import { FormStatusMessage } from "@/components/forms/form-status-message";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { idleActionState } from "@/lib/action-state";
import { updateSuggestionAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { hasWordDiff, wordDiff } from "@/lib/word-diff.mjs";

type DiffSegment = { type: "same" | "removed" | "added"; text: string };

type TruthVariant = "success" | "warning" | "destructive";

type SuggestionCardProps = {
  matchId: string;
  resumeId?: string;
  suggestionId: string;
  index: number;
  suggestionType: string;
  jobRequirement: string;
  truthLabel: string;
  truthVariant: TruthVariant;
  original: string;
  suggested: string;
  reason: string;
  evidence: string;
  userAction: string;
  userEdited: boolean;
};

const truthDot: Record<TruthVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const truthText: Record<TruthVariant, string> = {
  success: "text-success",
  warning: "text-[oklch(0.52_0.10_70)] dark:text-warning",
  destructive: "text-destructive",
};

// One side of the split diff. `keep` selects which change type survives
// alongthe unchanged words: "removed" → the original side, "added" → rewritten.
function DiffText({
  segments,
  keep,
}: {
  segments: DiffSegment[];
  keep: "removed" | "added";
}) {
  const visible = segments.filter((s) => s.type === "same" || s.type === keep);
  return (
    <p className="text-sm leading-6 text-foreground">
      {visible.map((segment, i) => {
        const space = i < visible.length - 1 ? " " : "";
        if (segment.type === "removed") {
          return (
            <span
              key={i}
              className="text-muted-foreground line-through decoration-destructive/60 decoration-1"
            >
              {segment.text}
              {space}
            </span>
          );
        }
        if (segment.type === "added") {
          return (
            <span
              key={i}
              className="rounded-[3px] bg-brand/15 px-0.5 font-medium text-foreground"
            >
              {segment.text}
              {space}
            </span>
          );
        }
        return (
          <span key={i}>
            {segment.text}
            {space}
          </span>
        );
      })}
    </p>
  );
}

export function SuggestionCard({
  matchId,
  resumeId,
  suggestionId,
  index,
  suggestionType,
  jobRequirement,
  truthLabel,
  truthVariant,
  original,
  suggested,
  reason,
  evidence,
  userAction,
  userEdited,
}: SuggestionCardProps) {
  const [state, formAction] = useActionState(updateSuggestionAction, idleActionState);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(suggested);

  const segments = (original ? wordDiff(original, text) : []) as DiffSegment[];
  const showDiff = Boolean(original) && hasWordDiff(segments);

  const accepted = userAction === "accepted";
  const rejected = userAction === "rejected";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg bg-card text-card-foreground shadow-sm ring-1 transition-colors",
        accepted ? "ring-success/30" : rejected ? "ring-border opacity-75" : "ring-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {String(index).padStart(2, "0")}
          </span>
          <span className="h-3.5 w-px bg-border" aria-hidden />
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", truthText[truthVariant])}>
            <span className={cn("size-1.5 rounded-full", truthDot[truthVariant])} aria-hidden />
            {truthLabel}
          </span>
          {suggestionType ? (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {suggestionType}
            </Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {userEdited ? (
            <span className="text-xs text-muted-foreground">Edited by you</span>
          ) : null}
          {accepted ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <Check className="size-3.5" /> Accepted
            </span>
          ) : rejected ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <X className="size-3.5" /> Rejected
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Pending review</span>
          )}
        </div>
      </div>

      <form action={formAction}>
        <input type="hidden" name="suggestion_id" value={suggestionId} />
        <input type="hidden" name="match_id" value={matchId} />
        <input type="hidden" name="initial_suggested_text" value={suggested} />
        {/* Always submits the current rewrite, even when the editor is collapsed. */}
        <input type="hidden" name="suggested_text" value={text} />

        {jobRequirement ? (
          <p className="px-4 pt-3 text-sm font-medium sm:px-5">{jobRequirement}</p>
        ) : null}

        {/* Original → Rewritten */}
        <div className="grid gap-3 px-4 py-3 sm:px-5 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          {/* Original */}
          <div className="rounded-md bg-muted/40 p-3 ring-1 ring-inset ring-border">
            <p className="mb-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
              Original
            </p>
            {original ? (
              showDiff ? (
                <DiffText segments={segments} keep="removed" />
              ) : (
                <p className="text-sm leading-6 text-foreground">{original}</p>
              )
            ) : (
              <p className="text-sm italic leading-6 text-muted-foreground">
                New addition — no existing line.
              </p>
            )}
          </div>

          {/* Arrow */}
          <div className="hidden items-center justify-center md:flex">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/20">
              <ArrowRight className="size-3.5" />
            </span>
          </div>

          {/* Rewritten */}
          <div className="rounded-md bg-brand/[0.04] p-3 ring-1 ring-inset ring-brand/25">
            <p className="mb-1.5 flex items-center gap-1 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-brand">
              <Sparkles className="size-3" /> Rewritten
            </p>
            {editing ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                aria-label="Edit suggested resume text"
                autoFocus
                className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-6 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            ) : showDiff ? (
              <DiffText segments={segments} keep="added" />
            ) : (
              <p className="text-sm leading-6 text-foreground">{text}</p>
            )}
          </div>
        </div>

        {/* Why this works */}
        {reason || evidence ? (
          <div className="border-t bg-muted/25 px-4 py-3 text-sm leading-6 sm:px-5">
            {reason ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Why this works</span>
                <span className="px-1.5 text-border" aria-hidden>·</span>
                {reason}
              </p>
            ) : null}
            {evidence ? (
              <p className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">Evidence</span>
                <span className="px-1.5 text-border" aria-hidden>·</span>
                {evidence}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Truth Guard honesty note: an accepted "Do not use yet" suggestion is
            still excluded from CV generation server-side — accepting only marks
            it reviewed. Say so plainly so the status isn't misleading. */}
        {truthVariant === "destructive" ? (
          <p className="flex items-start gap-1.5 border-t bg-destructive/[0.04] px-4 py-2.5 text-xs leading-5 text-muted-foreground sm:px-5">
            <ShieldAlert className="mt-px size-3.5 shrink-0 text-destructive" />
            <span>
              This won&apos;t be added to your CV — even if you accept it. To use it, close the gap
              in{" "}
              <Link
                href={`/matches/${matchId}/gaps`}
                className="font-medium text-foreground underline underline-offset-2"
              >
                Skill Gaps
              </Link>
              , add the proof to{" "}
              {resumeId ? (
                <Link
                  href={`/resumes/${resumeId}`}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  your résumé
                </Link>
              ) : (
                "your résumé"
              )}
              , then regenerate — Truth Guard moves it to &ldquo;Safe to use.&rdquo;
            </span>
          </p>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
          <FormStatusMessage state={state} />
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setText(suggested);
                  setEditing(false);
                }}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <RotateCcw data-icon="inline-start" />
                Reset
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Pencil data-icon="inline-start" />
                Edit
              </button>
            )}
            <button
              type="submit"
              name="user_action"
              value="rejected"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <X data-icon="inline-start" />
              Reject
            </button>
            <button
              type="submit"
              name="user_action"
              value="accepted"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              <Check data-icon="inline-start" />
              {accepted ? "Save edit" : "Accept"}
            </button>
          </div>
        </div>
      </form>
    </article>
  );
}
