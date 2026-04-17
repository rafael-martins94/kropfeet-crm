import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChevronLeft } from "./Icons";

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  backTo?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  backTo,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
            {breadcrumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {c.to ? (
                  <Link to={c.to} className="hover:text-brand-600 transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink-muted">{c.label}</span>
                )}
                {i < breadcrumbs.length - 1 ? (
                  <span className="text-line">/</span>
                ) : null}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex items-center gap-3">
          {backTo ? (
            <Link
              to={backTo}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand-400 hover:text-brand-700"
              aria-label="Voltar"
            >
              <IconChevronLeft />
            </Link>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold text-brand-700 sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
