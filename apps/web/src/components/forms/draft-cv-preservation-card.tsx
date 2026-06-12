"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

type Conflict = {
  bulletId: string;
  bulletText: string;
  entryLabel: string;
};

type DraftCvPreservationCardProps = {
  apiBaseUrl: string | null;
  draftCvId: string;
  conflicts: Conflict[];
};

// Regenerate-preservation prompts (US-060): a finalized bullet whose entry the
// regeneration restructured away gets an explicit keep-mine / take-new answer.
export function DraftCvPreservationCard({
  apiBaseUrl,
  draftCvId,
  conflicts,
}: DraftCvPreservationCardProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(bulletId: string, choice: "keep" | "discard") {
    if (!apiBaseUrl) {
      setError("The assistant API is not configured.");
      return;
    }
    setError(null);
    setBusyId(bulletId);
    try {
      const token = await getToken();
      const response = await fetch(
        `${apiBaseUrl}/api/draft-cvs/${draftCvId}/preservation/resolve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bullet_id: bulletId, choice }),
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? "Could not save your choice.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your choice.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {conflicts.map((conflict) => (
        <div key={conflict.bulletId} className="rounded-lg border p-3">
          <p className="text-sm">{conflict.bulletText}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You confirmed this bullet under <span className="font-medium">{conflict.entryLabel}</span>,
            but the regenerated CV no longer has that entry.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busyId !== null}
              onClick={() => resolve(conflict.bulletId, "keep")}
            >
              {busyId === conflict.bulletId ? "Saving..." : "Keep my bullet"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyId !== null}
              onClick={() => resolve(conflict.bulletId, "discard")}
            >
              Take the new version
            </Button>
          </div>
        </div>
      ))}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
