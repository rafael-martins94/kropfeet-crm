import type { ReactNode } from "react";

interface ScrollableListShellProps {
  toolbar?: ReactNode;
  /** Faixa opcional entre toolbar e lista (ex.: ações em massa). */
  banner?: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
}

/** Toolbar fixa, corpo com scroll, rodapé fixo — pai em coluna com `min-h-0`. */
export function ScrollableListShell({ toolbar, banner, body, footer }: ScrollableListShellProps) {
  return (
    <>
      {toolbar != null ? <div className="shrink-0">{toolbar}</div> : null}
      {banner != null ? <div className="shrink-0">{banner}</div> : null}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">{body}</div>
      {footer != null ? <div className="shrink-0">{footer}</div> : null}
    </>
  );
}
