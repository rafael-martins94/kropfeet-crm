import { cn } from "../utils/cn";

const LOADER_SRC = "/loading/load3.gif";

interface LoadingStateProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap: Record<NonNullable<LoadingStateProps["size"]>, string> = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

export function LoadingState({
  label = "Carregando…",
  className,
  size = "md",
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-10 text-sm text-ink-soft",
        className,
      )}
    >
      <img
        src={LOADER_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={cn("select-none object-contain", sizeMap[size])}
      />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function PageLoader({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-muted">
      <img
        src={LOADER_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-40 w-40 select-none object-contain"
      />
      {label ? (
        <span className="text-sm font-medium text-ink-soft">{label}</span>
      ) : null}
    </div>
  );
}

export function InlineLoader({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-soft">
      <img
        src={LOADER_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-10 w-10 select-none object-contain"
      />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600",
        className,
      )}
    />
  );
}
