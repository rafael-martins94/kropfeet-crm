import { cn } from "../utils/cn";
import { IconChevronLeft, IconChevronRight } from "./Icons";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const go = (p: number) => {
    const n = Math.min(Math.max(1, p), totalPages);
    if (n !== page) onPageChange(n);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row",
        className,
      )}
    >
      <div className="text-xs text-ink-soft">
        {total === 0 ? (
          "Nenhum resultado"
        ) : (
          <>
            Exibindo <span className="font-medium text-ink">{from}</span>–
            <span className="font-medium text-ink">{to}</span> de{" "}
            <span className="font-medium text-ink">{total.toLocaleString("pt-BR")}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Página anterior"
        >
          <IconChevronLeft width={16} height={16} />
        </button>
        <span className="rounded-lg bg-surface-muted px-3 py-1 text-xs font-medium text-ink">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Próxima página"
        >
          <IconChevronRight width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
