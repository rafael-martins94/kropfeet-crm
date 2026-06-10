import type { ReactNode } from "react";
import { cn } from "../utils/cn";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section className={cn("card overflow-hidden", className)}>
      {hasHeader ? (
        <header
          className={cn(
            "border-b border-line px-5 py-4",
            title || description
              ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              : "flex items-center",
          )}
        >
          {title || description ? (
            <div className="min-w-0">
              {title ? (
                <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>
              ) : null}
              {description ? (
                <p className="text-xs text-ink-soft mt-0.5">{description}</p>
              ) : null}
            </div>
          ) : null}
          {actions ? (
            <div
              className={cn(
                "flex items-center gap-2",
                !(title || description) && "w-full min-w-0",
              )}
            >
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className={cn(noPadding ? "" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
