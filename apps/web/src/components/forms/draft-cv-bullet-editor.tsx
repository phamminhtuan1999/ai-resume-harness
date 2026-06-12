"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasWordDiff, wordDiff } from "@/lib/word-diff.mjs";

type PendingEdit = {
  userText: string;
  polishedText: string;
  truthGuardStatus: string;
  evidenceQuestion: string | null;
};

type EditorBullet = {
  id: string | null;
  text: string;
  userEdited: boolean;
  polished: boolean;
  originalText: string;
  sourceFeedbackId: string | null;
  pendingEdit: PendingEdit | null;
};

type DraftCvBulletEditorProps = {
  apiBaseUrl: string | null;
  draftCvId: string;
  bullet: EditorBullet;
};

type DiffSegment = { type: "same" | "removed" | "added"; text: string };

// Tier-2 polish-and-confirm editor (US-060, decision 0019 Amendment II): the
// user's edit is information-level feedback. Save runs ONE server pass
// (tone-polish + truth-guard verify); the user then confirms a word-diff —
// default "Use polished", with "Keep my wording" as the exact-terminology
// escape hatch. The server stages the result; this client only ever sends the
// user's text and a choice, never a status.
export function DraftCvBulletEditor({
  apiBaseUrl,
  draftCvId,
  bullet,
}: DraftCvBulletEditorProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(bullet.text);
  const [pending, setPending] = useState<PendingEdit | null>(bullet.pendingEdit);
  const [busy, setBusy] = useState<"check" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function request(path: string, body: unknown) {
    const token = await getToken();
    const response = await fetch(`${apiBaseUrl}/api/draft-cvs/${draftCvId}${path}`, {
      method: path.endsWith("/confirm") ? "POST" : "PATCH",
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? payload?.detail ?? "Request failed.");
    }
    return payload;
  }

  async function handleCheck() {
    if (!apiBaseUrl || !bullet.id) {
      setError("The assistant API is not configured.");
      return;
    }
    setError(null);
    setBusy("check");
    try {
      const payload = await request(`/bullets/${bullet.id}/text`, { text: text.trim() });
      setPending({
        userText: payload.user_text ?? text.trim(),
        polishedText: payload.polished_text ?? text.trim(),
        truthGuardStatus: payload.truth_guard_status ?? "needs_confirmation",
        evidenceQuestion: payload.evidence_question ?? null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not check this edit.");
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirm(choice: "polished" | "mine" | "cancel") {
    if (!apiBaseUrl || !bullet.id) return;
    setError(null);
    setBusy("confirm");
    try {
      await request(`/bullets/${bullet.id}/text/confirm`, { choice });
      setPending(null);
      setEditing(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save this edit.");
    } finally {
      setBusy(null);
    }
  }

  const provenance = bullet.userEdited
    ? "Edited here"
    : bullet.sourceFeedbackId
      ? "From your feedback"
      : "AI suggested";

  if (pending) {
    const segments = wordDiff(pending.userText, pending.polishedText) as DiffSegment[];
    const changed = hasWordDiff(segments);
    return (
      <div className="my-1 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {changed
            ? "ApplyWise polished your wording to match the CV's tone — same information, your call:"
            : "Verified — the wording already matches the CV's tone:"}
        </p>
        <p className="text-sm leading-6">
          {segments.map((segment, index) => (
            <span
              key={index}
              className={
                segment.type === "removed"
                  ? "text-muted-foreground line-through decoration-destructive/60"
                  : segment.type === "added"
                    ? "rounded-sm bg-brand-muted px-0.5 font-medium"
                    : undefined
              }
            >
              {segment.text}
              {index < segments.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
        {pending.truthGuardStatus !== "safe_to_use" ? (
          <p className="text-xs text-warning-foreground">
            Truth Guard: {pending.truthGuardStatus === "do_not_use_yet"
              ? "this claim is not supported by your evidence and will not export."
              : "this lands in the review queue before it can export."}
            {pending.evidenceQuestion ? ` ${pending.evidenceQuestion}` : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy !== null}
            onClick={() => handleConfirm("polished")}
          >
            {busy === "confirm" ? "Saving..." : "Use polished"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => handleConfirm("mine")}
          >
            Keep my wording
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => handleConfirm("cancel")}
          >
            Cancel
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="my-1 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={240}
          aria-label="Edit this bullet"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-6 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy !== null || !text.trim()}
            onClick={handleCheck}
          >
            {busy === "check" ? "Checking..." : "Save"}
          </Button>
          {bullet.originalText ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setText(bullet.originalText)}
            >
              Restore original
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => {
              setEditing(false);
              setText(bullet.text);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <span className="group inline-flex flex-wrap items-center gap-1.5">
      <span>{bullet.text}</span>
      <Badge variant="outline" className="text-[10px]">
        {provenance}
      </Badge>
      <button
        type="button"
        aria-label={`Edit bullet: ${bullet.text.slice(0, 40)}`}
        className="rounded-sm p-0.5 text-muted-foreground opacity-60 transition-opacity hover:text-foreground group-hover:opacity-100"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" />
      </button>
    </span>
  );
}
