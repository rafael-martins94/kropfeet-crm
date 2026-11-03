import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useOrigemNavegacao } from "../hooks/useListDetailNavigation";
import { IconChevronLeft } from "./Icons";

interface Crumb {
  label: string;
  to?: string;
  state?: unknown;
}

interface PageHeaderProps {
  title: ReactNode;
  titleAccessory?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  backTo?: string;
  backState?: unknown;
  compacto?: boolean;
}

export function PageHeader({
  title,
  titleAccessory,
  breadcrumbs,
  actions,
  backTo,
  backState,
  compacto = false,
}: PageHeaderProps) {
  // Aberta a partir de outro registro: voltar retorna para ele.
  const origem = useOrigemNavegacao();
  const voltarPara = origem ? origem.path : backTo;
  const voltarState = origem ? origem.state : backState;

  return (
    <div
      className={
        compacto
          ? "mb-0 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
          : "mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between lg:mb-6"
      }
    >
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className={`${compacto ? "mb-1" : "mb-2"} hidden flex-wrap items-center gap-1.5 text-xs text-ink-soft lg:flex`}>
            {breadcrumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {c.to ? (
                  <Link to={c.to} state={c.state} className="hover:text-brand-600 transition-colors">
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
        <div className="flex min-h-10 items-center gap-2 max-lg:pl-12 lg:gap-3">
          {backTo ? (
            <Link
              to={voltarPara!}
              state={voltarState}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand-400 hover:text-brand-700"
              aria-label="Voltar"
            >
              <IconChevronLeft />
            </Link>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 lg:gap-3">
            <h1
              className={
                compacto
                  ? "min-w-0 max-w-full truncate font-display text-xl font-semibold text-brand-700 sm:text-2xl"
                  : "min-w-0 max-w-full truncate font-display text-xl font-semibold text-brand-700 sm:text-2xl lg:text-3xl"
              }
            >
              {title}
            </h1>
            {titleAccessory}
          </div>
        </div>
      </div>
      {actions ? <div className="ml-auto flex flex-shrink-0 items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}
