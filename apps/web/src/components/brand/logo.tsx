import { cn } from "@/lib/utils";

/*
  ApplyWise brand mark: a single geometric glyph in the emerald brand tile.
  The line reads as a checkmark that kinks into an upward arrow ("verified, and
  rising"), tying to the product's honest-improvement thesis. Simple geometry
  only, rendered inline so it themes with the system.
*/
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-[0.62rem] bg-primary text-primary-foreground shadow-sm shadow-primary/30 ring-1 ring-inset ring-white/15",
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M4.8 12.8l3.7 3.7L19.1 6"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.7 6h5.4v5.4"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

type LogoProps = {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  subtitle?: string;
};

export function Logo({
  className,
  markClassName,
  wordmark = true,
  subtitle,
}: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      {wordmark ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="font-display text-[0.95rem] font-semibold tracking-tight text-foreground">
            ApplyWise
          </span>
          {subtitle ? (
            <span className="mt-1 truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
