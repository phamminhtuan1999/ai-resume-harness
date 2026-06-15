"use client";

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { draftCvToText } from "@/lib/draft-cv-view.mjs";
import {
  diffByLine,
  diffCharStats,
  diffWordsByLine,
} from "@/lib/version-diff.mjs";

type DiffVersion = {
  id: string;
  version: number;
  cv_json: Record<string, unknown>;
};

type VersionDiffPanelProps = {
  versions: DiffVersion[];
  // Skip the Card chrome when embedded in an existing container (e.g. a
  // collapsible details section) so it doesn't read as a box-in-box.
  bare?: boolean;
};

type Mode = "words" | "lines";
type Segment = { type: "same" | "added" | "removed"; text: string };

const SEGMENT_CLASS: Record<Segment["type"], string> = {
  same: "",
  added: "rounded-sm bg-brand-muted px-0.5 font-medium text-foreground",
  removed:
    "rounded-sm bg-destructive/10 px-0.5 text-muted-foreground line-through decoration-destructive/60",
};

function signedChars(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value)}`;
}

export function VersionDiffPanel({ versions, bare = false }: VersionDiffPanelProps) {
  // Versions arrive newest-first; show oldest-first so the pickers read v1..vN.
  const ordered = useMemo(
    () => [...versions].sort((a, b) => a.version - b.version),
    [versions]
  );
  const latest = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];

  const [mode, setMode] = useState<Mode>("words");
  const [fromId, setFromId] = useState<string>(previous?.id ?? latest?.id ?? "");
  const [toId, setToId] = useState<string>(latest?.id ?? "");

  const fromVersion = ordered.find((v) => v.id === fromId) ?? previous ?? latest;
  const toVersion = ordered.find((v) => v.id === toId) ?? latest;

  const { beforeText, afterText, stats, wordLines, lineRows } = useMemo(() => {
    const before = draftCvToText(fromVersion?.cv_json);
    const after = draftCvToText(toVersion?.cv_json);
    return {
      beforeText: before,
      afterText: after,
      stats: diffCharStats(before, after),
      wordLines: diffWordsByLine(before, after) as Segment[][],
      lineRows: diffByLine(before, after) as { type: Segment["type"]; text: string }[],
    };
  }, [fromVersion?.cv_json, toVersion?.cv_json]);

  const sameVersion = fromVersion?.id === toVersion?.id;
  const identical = !sameVersion && beforeText === afterText;

  const modeToggle = (
    <div className="flex shrink-0 rounded-full border p-0.5 text-xs font-medium">
      {(["words", "lines"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          aria-pressed={mode === value}
          className={`rounded-full px-3 py-1 capitalize transition-colors ${
            mode === value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );

  const content = (
    <>
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <VersionPicker
            label="From"
            versions={ordered}
            selectedId={fromVersion?.id ?? ""}
            onSelect={setFromId}
          />
          <span aria-hidden className="text-muted-foreground">
            →
          </span>
          <VersionPicker
            label="To"
            versions={ordered}
            selectedId={toVersion?.id ?? ""}
            onSelect={setToId}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/10 px-4 py-3 sm:grid-cols-4">
          <Stat label="Added" value={`${signedChars(stats.added)} chars`} tone="added" />
          <Stat
            label="Removed"
            value={`${stats.removed > 0 ? "−" : ""}${stats.removed} chars`}
            tone="removed"
          />
          <Stat label="Net change" value={`${signedChars(stats.net)} chars`} tone="net" />
          <div className="hidden flex-col justify-center text-right sm:flex">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Comparing</span>
            <span className="text-sm font-medium">
              v{fromVersion?.version} → v{toVersion?.version}
            </span>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Inline diff · {mode}</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand-muted" /> Added
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive/40" /> Removed
              </span>
            </span>
          </div>
          <div className="max-h-[28rem] overflow-auto px-4 py-3 font-mono text-xs leading-6">
            {sameVersion ? (
              <p className="text-muted-foreground">
                Pick two different versions to see what changed.
              </p>
            ) : identical ? (
              <p className="text-muted-foreground">
                These versions render identical content.
              </p>
            ) : mode === "words" ? (
              <WordsDiff lines={wordLines} />
            ) : (
              <LinesDiff rows={lineRows} />
            )}
          </div>
        </div>
    </>
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Compare any two versions</p>
          {modeToggle}
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Version Diff</CardTitle>
          <CardDescription>Compare what changed between any two versions.</CardDescription>
        </div>
        {modeToggle}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{content}</CardContent>
    </Card>
  );
}

function VersionPicker({
  label,
  versions,
  selectedId,
  onSelect,
}: {
  label: string;
  versions: DiffVersion[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex flex-wrap gap-1">
        {versions.map((version) => (
          <button
            key={version.id}
            type="button"
            onClick={() => onSelect(version.id)}
            aria-pressed={version.id === selectedId}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              version.id === selectedId
                ? "bg-brand text-brand-foreground"
                : "border text-muted-foreground hover:text-foreground"
            }`}
          >
            v{version.version}
          </button>
        ))}
      </span>
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "added" | "removed" | "net";
}) {
  const toneClass =
    tone === "added"
      ? "text-success"
      : tone === "removed"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function WordsDiff({ lines }: { lines: Segment[][] }) {
  return (
    <div className="whitespace-pre-wrap break-words">
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="min-h-[1.5em]">
          {line.map((segment, index) => (
            <span key={index} className={SEGMENT_CLASS[segment.type]}>
              {index > 0 ? " " : ""}
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function LinesDiff({ rows }: { rows: { type: Segment["type"]; text: string }[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => {
        const tone =
          row.type === "added"
            ? "bg-brand-muted/50"
            : row.type === "removed"
              ? "bg-destructive/10 text-muted-foreground line-through decoration-destructive/50"
              : "";
        const sign = row.type === "added" ? "+" : row.type === "removed" ? "−" : " ";
        return (
          <div key={index} className={`flex gap-2 px-1 ${tone}`}>
            <span aria-hidden className="select-none text-muted-foreground">
              {sign}
            </span>
            <span className="whitespace-pre-wrap break-words">{row.text || " "}</span>
          </div>
        );
      })}
    </div>
  );
}
