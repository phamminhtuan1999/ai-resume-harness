"use client";

type AtsGaugeProps = {
  score: number;
  label?: string;
  size?: number;
  showScale?: boolean;
};

function scoreToColor(score: number): string {
  if (score >= 75) return "var(--color-success)";
  if (score >= 60) return "var(--color-info)";
  if (score >= 40) return "var(--color-warning)";
  return "var(--color-destructive)";
}

function scoreToLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs work";
}

// Semicircle gauge. The arc is a full circle clipped to its top half via
// overflow:hidden; stroke-dasharray + rotate(180) draws only the top semicircle.
// The number lives in the arc "well"; scale + quality label render as HTML below.
export function AtsGauge({ score, label, size = 180, showScale = true }: AtsGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  const strokeW = size * 0.075;
  const circumference = Math.PI * r;
  const filled = (clamped / 100) * circumference;
  const color = scoreToColor(clamped);
  const qualLabel = label ?? scoreToLabel(clamped);
  const visibleH = cy + strokeW / 2;

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: visibleH, position: "relative", overflow: "hidden" }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: "absolute", top: 0, left: 0 }}
          role="img"
          aria-label={`ATS score: ${clamped} out of 100`}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={strokeW}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(180 ${cx} ${cy})`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(180 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.22,1,0.36,1)" }}
          />
          <text
            x={cx}
            y={cy - r * 0.3}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--color-foreground)"
            fontSize={size * 0.21}
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            {clamped}
          </text>
        </svg>
      </div>

      <div className="-mt-1 flex flex-col items-center gap-0.5">
        {showScale && (
          <span className="text-xs text-muted-foreground">out of 100</span>
        )}
        <span className="text-sm font-semibold" style={{ color }}>
          {qualLabel}
        </span>
      </div>
    </div>
  );
}

// Compact arc-only gauge — renders just the visual indicator (no number),
// so it pairs with an external numeric label without duplicating the value.
export function MiniGauge({ score, size = 96 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  const strokeW = size * 0.09;
  const circumference = Math.PI * r;
  const filled = (clamped / 100) * circumference;
  const color = scoreToColor(clamped);
  const visibleH = cy + strokeW / 2;

  return (
    <div style={{ width: size, height: visibleH, position: "relative", overflow: "hidden" }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", top: 0, left: 0 }}
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={strokeW}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(180 ${cx} ${cy})`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(180 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
    </div>
  );
}
