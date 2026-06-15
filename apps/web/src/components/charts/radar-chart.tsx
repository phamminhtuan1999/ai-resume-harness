"use client";

type RadarDatum = {
  label: string;
  value: number;
};

type RadarChartProps = {
  data: RadarDatum[];
  /** Max width in px; chart is centered and scales down responsively. */
  maxWidth?: number;
};

const VBW = 360;
const VBH = 320;
const CX = VBW / 2;
const CY = VBH / 2 + 4;
const R = 104;
const LEVELS = [25, 50, 75, 100];

function scoreColor(score: number): string {
  if (score >= 75) return "var(--color-success)";
  if (score >= 60) return "var(--color-info)";
  if (score >= 40) return "var(--color-warning)";
  return "var(--color-destructive)";
}

function pointAt(index: number, n: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + index * ((2 * Math.PI) / n);
  const rr = R * (Math.max(0, Math.min(100, value)) / 100);
  return [CX + rr * Math.cos(angle), CY + rr * Math.sin(angle)];
}

export function RadarChart({ data, maxWidth = 340 }: RadarChartProps) {
  const n = data.length;

  if (n < 3) {
    // Radar needs at least 3 axes to read; fall back to a simple message.
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Need at least three categories to chart.
      </p>
    );
  }

  // Grid ring polygons
  const rings = LEVELS.map((level) =>
    data
      .map((_, i) => {
        const [x, y] = pointAt(i, n, level);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ")
  );

  // Data polygon
  const dataPoints = data.map((d, i) => pointAt(i, n, d.value));
  const dataPoly = dataPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Axis spokes (to the 100 ring)
  const spokes = data.map((_, i) => pointAt(i, n, 100));

  return (
    <div className="flex w-full justify-center">
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ maxWidth, height: "auto", aspectRatio: `${VBW} / ${VBH}` }}
        role="img"
        aria-label={`Category score breakdown: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
      >
        {/* Grid rings */}
        {rings.map((points, i) => (
          <polygon
            key={`ring-${i}`}
            points={points}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}

        {/* Spokes */}
        {spokes.map(([x, y], i) => (
          <line
            key={`spoke-${i}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}

        {/* Scale numbers along the top spoke */}
        {LEVELS.map((level) => {
          const [, y] = pointAt(0, n, level);
          return (
            <text
              key={`scale-${level}`}
              x={CX + 5}
              y={y + 3}
              fill="var(--color-muted-foreground)"
              fontSize="9"
              fontFamily="var(--font-mono)"
              opacity="0.65"
            >
              {level}
            </text>
          );
        })}

        {/* Data polygon */}
        <polygon
          points={dataPoly}
          fill="var(--color-brand)"
          fillOpacity="0.18"
          stroke="var(--color-brand)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Vertex dots */}
        {dataPoints.map(([x, y], i) => (
          <circle
            key={`dot-${i}`}
            cx={x}
            cy={y}
            r="3.5"
            fill="var(--color-brand)"
            stroke="var(--color-card)"
            strokeWidth="1.5"
          />
        ))}

        {/* Axis labels + values */}
        {data.map((d, i) => {
          const angle = -Math.PI / 2 + i * ((2 * Math.PI) / n);
          const lx = CX + (R + 24) * Math.cos(angle);
          const ly = CY + (R + 24) * Math.sin(angle);
          const cos = Math.cos(angle);
          const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
          const color = scoreColor(d.value);
          return (
            <g key={`label-${i}`}>
              <text
                x={lx}
                y={ly - 4}
                textAnchor={anchor}
                fill="var(--color-muted-foreground)"
                fontSize="11"
                fontFamily="var(--font-sans)"
              >
                {d.label}
              </text>
              <text
                x={lx}
                y={ly + 9}
                textAnchor={anchor}
                fill={color}
                fontSize="12"
                fontWeight="700"
                fontFamily="var(--font-mono)"
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
