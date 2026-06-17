"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Download, FileCode, FileText } from "lucide-react";

import { useDraftCvRenderOptions } from "@/components/draft-cv/render-options-context";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  compressionSummary,
  exportFileName,
  exportUrl,
  fontOptions,
  overrideWarning,
  pageOptions,
} from "@/lib/draft-cv-view.mjs";

type RenderingView = {
  recommendedPages: number;
  maxPages: number;
  fontProfile: string;
  fontProfileLabel: string;
};

type DraftCvExportButtonsProps = {
  apiBaseUrl: string | null;
  draftCvId: string;
  fileSlug: string;
  pendingReviewCount: number;
  rendering: RenderingView | null;
};

const FORMATS = [
  { format: "pdf", label: "Export PDF", icon: FileText },
  { format: "docx", label: "Export DOCX", icon: Download },
  { format: "markdown", label: "Export Markdown", icon: FileCode },
] as const;

type CompressionView = ReturnType<typeof compressionSummary>;

export function DraftCvExportButtons({
  apiBaseUrl,
  draftCvId,
  fileSlug,
  pendingReviewCount,
  rendering,
}: DraftCvExportButtonsProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compression, setCompression] = useState<CompressionView>(null);

  // Page/font selection is shared with the inline PDF preview (US-078) via
  // context so the preview matches the export. A local fallback keeps this
  // component usable on its own (no provider mounted).
  const shared = useDraftCvRenderOptions();
  const [localPages, setLocalPages] = useState<number>(
    rendering?.recommendedPages ?? 1
  );
  const [localFont, setLocalFont] = useState<string>(
    rendering?.fontProfile ?? "modern_latex"
  );
  const selectedPages = shared ? shared.pages : localPages;
  const setSelectedPages = shared ? shared.setPages : setLocalPages;
  const selectedFont = shared ? shared.font : localFont;
  const setSelectedFont = shared ? shared.setFont : setLocalFont;

  const recommendedPages = rendering?.recommendedPages ?? null;
  const recommendedFont = rendering?.fontProfile ?? null;
  const warning = recommendedPages
    ? overrideWarning(recommendedPages, selectedPages)
    : null;

  // Preview the compression report for the selected page count so the user
  // sees what will be condensed before downloading. Best-effort; failures just
  // hide the summary. The cancel guard drops stale responses if the selection
  // changes mid-flight.
  useEffect(() => {
    if (!apiBaseUrl || !rendering) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        // Font affects measurement, so the compression preview must render with
        // the same font the export will use.
        const fontParam =
          selectedFont && selectedFont !== recommendedFont ? `&font=${selectedFont}` : "";
        const response = await fetch(
          `${apiBaseUrl}/api/draft-cvs/${draftCvId}/export-preview?pages=${selectedPages}${fontParam}`,
          { headers: { Authorization: `Bearer ${token ?? ""}` } }
        );
        const body = response.ok ? await response.json() : null;
        if (!cancelled) {
          setCompression(compressionSummary(body?.rendering?.compression));
        }
      } catch {
        if (!cancelled) setCompression(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, draftCvId, getToken, recommendedFont, rendering, selectedFont, selectedPages]);

  async function handleExport(format: "pdf" | "docx" | "markdown") {
    setError(null);
    if (!apiBaseUrl) {
      setError("The assistant API is not configured.");
      return;
    }
    if (
      pendingReviewCount > 0 &&
      !window.confirm(
        `${pendingReviewCount} item(s) still need review and will be excluded from the export. Export anyway?`
      )
    ) {
      return;
    }

    setBusy(format);
    try {
      const token = await getToken();
      const response = await fetch(
        exportUrl(
          apiBaseUrl,
          draftCvId,
          format,
          selectedPages,
          recommendedPages,
          selectedFont,
          recommendedFont
        ),
        { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "We could not export this CV. Please try again.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(fileSlug, format);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      // The export stamped the draft (status -> exported) server-side; refresh
      // the server components so the stepper and status badge turn green now,
      // not on the next manual reload.
      router.refresh();
    } catch {
      setError("We could not reach the assistant. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const options = rendering ? pageOptions(rendering) : [];

  return (
    <div className="flex flex-col gap-2">
      {rendering && options.length > 1 ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Page count
          <Select
            value={selectedPages}
            onChange={(event) => setSelectedPages(Number(event.target.value))}
            disabled={busy !== null}
          >
            {options.map((count) => (
              <option key={count} value={count}>
                {count} page{count === 1 ? "" : "s"}
                {count === recommendedPages ? " (recommended)" : ""}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      {rendering ? (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Font
          <Select
            value={selectedFont}
            onChange={(event) => setSelectedFont(event.target.value)}
            disabled={busy !== null}
          >
            {fontOptions().map(({ key, label }: { key: string; label: string }) => (
              <option key={key} value={key}>
                {label}
                {key === recommendedFont ? " (recommended)" : ""}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      {warning ? (
        <p className="text-xs text-warning-foreground">{warning}</p>
      ) : null}

      {compression && compression.condensed.length ? (
        <p className="text-xs text-muted-foreground">
          To fit {compression.pageTarget} page{compression.pageTarget === 1 ? "" : "s"}, ApplyWise
          will condense {compression.condensed.join(", ")}.
        </p>
      ) : null}

      {compression && compression.overflow ? (
        <p className="text-xs text-warning-foreground">
          Your job-critical evidence needs {compression.measuredPages} pages — the export keeps it
          all rather than cut required content.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map(({ format, label, icon: Icon }) => (
          <Button
            key={format}
            type="button"
            variant={format === "pdf" ? "default" : "outline"}
            size="sm"
            disabled={busy !== null}
            onClick={() => handleExport(format)}
          >
            <Icon data-icon="inline-start" />
            {busy === format ? "Exporting..." : label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
