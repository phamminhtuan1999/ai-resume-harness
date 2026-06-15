"use client";

import { useState } from "react";

type DataPoint = {
  label: string;
  score: number;
  date: string;
};

type ScoreTrendChartProps = {
  data: DataPoint[];
  height?: number;
};

// Fixed coordinate system — the SVG scales uniformly to fill its container, so
// text and dots never distort (no preserveAspectRatio="none").
const VBW = 720;
const PAD = { top: 18, right: 16, bottom: 30, left: 34 };

function scoreToVariant(score: number): string {
  if (score >= 75) return "var(--color-success)";
  if (score >= 60) return "var(--color-info)";
  if (score >= 40) return "var(--color-warning)";
  return "var(--color-destructive)";
}

export function ScoreTrendChart({ data, height = 220 }: ScoreTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No analyses yet
      </div>
    );
  }

  const VBH = height;
  const innerW = VBW - PAD.left - PAD.right;
  const innerH = VBH - PAD.top - PAD.bottom;

  const minScore = 0;
  const maxScore = 100;

  const xOf = (i: number) =>
    data.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (data.length - 1)) * innerW;

  const yOf = (score: number) =>
    PAD.top + innerH - ((score - minScore) / (maxScore - minScore)) * innerH;

  const points = data.map((d, i) => ({ x: xOf(i), y: yOf(d.score) }));

  // Smooth cubic-bezier path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    pathD += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }

  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${PAD.top + innerH}` +
    ` L ${points[0].x} ${PAD.top + innerH} Z`;

  const gridLines = [0, 25, 50, 75, 100];
  const slotW = innerW / data.length;

  return (
    <svg
      viewBox={`0 0 ${VBW} ${VBH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      style={{ height: "auto", aspectRatio: `${VBW} / ${VBH}` }}
      role="img"
      aria-label={`Score trend across ${data.length} ${data.length === 1 ? "analysis" : "analyses"}`}
    >
      <defs>
        <linearGradient id="trend-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines + y labels */}
      {gridLines.map((v) => {
        const y = yOf(v);
        return (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={y}
              x2={PAD.left + innerW}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray={v === 0 ? "none" : "3 4"}
            />
            <text
              x={PAD.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--color-muted-foreground)"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        );
      })}

      {/* Area */}
      <path d={areaD} fill="url(#trend-area-fill)" />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="var(--color-chart-1)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots, x labels, hover */}
      {points.map((pt, i) => {
        const isHov = hovered === i;
        const score = data[i].score;
        const color = scoreToVariant(score);
        return (
          <g key={i}>
            <text
              x={pt.x}
              y={PAD.top + innerH + 20}
              textAnchor="middle"
              fill="var(--color-muted-foreground)"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {data[i].label}
            </text>

            {isHov && (
              <line
                x1={pt.x}
                y1={PAD.top}
                x2={pt.x}
                y2={PAD.top + innerH}
                stroke="var(--color-border)"
                strokeWidth="1"
              />
            )}

            <circle
              cx={pt.x}
              cy={pt.y}
              r={isHov ? 6 : 4}
              fill={color}
              stroke="var(--color-card)"
              strokeWidth="2"
              style={{ transition: "r 120ms ease-out" }}
            />

            {isHov && (
              <g>
                <rect
                  x={pt.x - 18}
                  y={pt.y - 30}
                  width="36"
                  height="20"
                  rx="4"
                  fill="var(--color-popover)"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
                <text
                  x={pt.x}
                  y={pt.y - 20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--color-foreground)"
                  fontSize="12"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                >
                  {score}
                </text>
              </g>
            )}

            {/* Hit target */}
            <rect
              x={pt.x - slotW / 2}
              y={PAD.top}
              width={slotW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "crosshair" }}
            />
          </g>
        );
      })}
    </svg>
  );
}
