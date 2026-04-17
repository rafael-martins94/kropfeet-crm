import type { ReactNode } from "react";
import { cn } from "../utils/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "brand" | "accent" | "neutral";
  loading?: boolean;
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
}: StatCardProps) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-ink-soft">
            {label}
          </div>
          <div className="mt-2 font-numeric text-[1.875rem] font-medium tabular-nums tracking-tight text-brand-800">
            {loading ? <span className="skeleton inline-block h-8 w-24 rounded" /> : value}
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
