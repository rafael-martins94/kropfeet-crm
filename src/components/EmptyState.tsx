import type { ReactNode } from "react";
import { IconBox } from "./Icons";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title = "Nada por aqui ainda",
  description = "Quando houver dados, eles aparecerão neste espaço.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
        {icon ?? <IconBox width={26} height={26} />}
      </div>
      <h4 className="text-base font-semibold text-ink">{title}</h4>
      <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
