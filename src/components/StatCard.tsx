import type { ReactNode } from "react";
import { cn } from "../utils/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "brand" | "accent" | "neutral";
  loading?: boolean;
  compact?: boolean;
}

const tones = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  accent: "bg-accent-50 text-accent-700 ring-accent-200",
  neutral: "bg-surface-subtle text-ink ring-line",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
  loading,
  compact = false,
}: StatCardProps) {
  return (
    <div className={cn("card card-hover", compact ? "px-3 py-2" : "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-ink-soft">
            {label}
          </div>
          <div
            className={cn(
              "font-numeric font-medium tabular-nums tracking-tight text-brand-800",
              compact ? "mt-0.5 text-lg leading-tight" : "mt-2 text-[1.875rem]",
            )}
          >
            {loading ? (
              <span className={cn("skeleton inline-block rounded", compact ? "h-5 w-16" : "h-8 w-24")} />
            ) : (
              value
            )}
          </div>
          {hint ? <div className="mt-1.5 text-xs text-ink-soft">{hint}</div> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
              tones[tone],
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
