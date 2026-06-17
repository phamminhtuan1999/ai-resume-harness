"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { FileText } from "lucide-react";

import { useDraftCvRenderOptions } from "@/components/draft-cv/render-options-context";
import { Button } from "@/components/ui/button";
import { previewUrl } from "@/lib/draft-cv-view.mjs";

type DraftCvPdfPreviewProps = {
  apiBaseUrl: string | null;
  draftCvId: string;
};

type PreviewState = "idle" | "loading" | "ready" | "error";

// On-demand inline render of the draft CV as PDF. Hits the read-only preview
// endpoint (no export stamp), so opening this never advances the draft to
// "exported" — only the Export buttons do. The blob URL is revoked on refresh
// and unmount so we don't leak object URLs. The selected page count / font are
// read from shared context (US-078) so the preview is the document Export will
// produce, not a default sample.
export function DraftCvPdfPreview({ apiBaseUrl, draftCvId }: DraftCvPdfPreviewProps) {
  const { getToken } = useAuth();
  const options = useDraftCvRenderOptions();
  const [state, setState] = useState<PreviewState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  async function loadPreview() {
    if (!apiBaseUrl) {
      setError("The assistant API is not configured.");
      setState("error");
      return;
    }
    setState("loading");
    setError(null);
    try {
      const token = await getToken();
      const endpoint = options
        ? previewUrl(
            apiBaseUrl,
            draftCvId,
            options.pages,
            options.recommendedPages,
            options.font,
            options.recommendedFont
          )
        : `${apiBaseUrl}/api/draft-cvs/${draftCvId}/preview/pdf`;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "We could not render the preview. Please try again.");
        setState("error");
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = objectUrl;
      setUrl(objectUrl);
      setState("ready");
    } catch {
      setError("We could not reach the assistant. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadPreview}
          disabled={state === "loading"}
        >
          <FileText data-icon="inline-start" />
          {state === "loading"
            ? "Rendering…"
            : state === "ready"
              ? "Refresh preview"
              : "Preview PDF"}
        </Button>
        {state === "ready" ? (
          <span className="text-xs text-muted-foreground">
            Live render of the current draft — viewing this does not export it.
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {url ? (
        <iframe
          title="CV PDF preview"
          src={url}
          className="h-[42rem] w-full rounded-lg border bg-muted/20"
        />
      ) : null}
    </div>
  );
}
