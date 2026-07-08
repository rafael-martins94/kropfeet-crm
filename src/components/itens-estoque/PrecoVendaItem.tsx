import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import {
  formatarPrecoVendaDoItem,
  formatarPrecoVendaItem,
  type ItemComPrecoVenda,
} from "../../utils/moedaItemEstoque";

type PrecoVendaItemProps = ItemComPrecoVenda & {
  tipoRegiaoLocal?: string | null;
  className?: string;
  vazio?: string;
  /** compact = célula de tabela; destaque = card na página de detalhe */
  variant?: "compact" | "destaque";
  /** Conteúdo extra dentro do card (ex.: botão de histórico). Só em variant="destaque". */
  acao?: ReactNode;
};

export function PrecoVendaItem({
  preco_venda,
  moeda_venda,
  local,
  tipoRegiaoLocal,
  className,
  vazio = "—",
  variant = "compact",
  acao,
}: PrecoVendaItemProps) {
  const tipoRegiao = tipoRegiaoLocal ?? local?.tipo_regiao;

  const texto =
    preco_venda != null || moeda_venda != null
      ? formatarPrecoVendaItem(preco_venda, moeda_venda, tipoRegiao)
      : local
        ? formatarPrecoVendaDoItem({ preco_venda, moeda_venda, local })
        : formatarPrecoVendaItem(preco_venda, moeda_venda, tipoRegiaoLocal);

  if (variant === "destaque") {
    return (
      <div
        className={cn(
          "rounded-xl border border-line bg-surface px-4 py-3 shadow-sm",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
            Preço de venda
          </p>
          {acao}
        </div>
        <p
          className={cn(
            "mt-1 font-numeric text-2xl font-semibold tabular-nums",
            texto ? "text-ink" : "text-ink-faint",
          )}
        >
          {texto ?? vazio}
        </p>
      </div>
    );
  }

  if (!texto) {
    return <span className={cn("text-sm text-ink-soft", className)}>{vazio}</span>;
  }

  return (
    <span className={cn("font-numeric text-sm font-semibold tabular-nums text-ink", className)}>
      {texto}
    </span>
  );
}
