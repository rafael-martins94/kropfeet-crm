import { cn } from "../utils/cn";
import { traduzirEnum } from "../utils/format";

type Tom = "neutro" | "sucesso" | "aviso" | "erro" | "info" | "brand";

const mapaTom: Record<Tom, string> = {
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
  sucesso: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  aviso: "bg-amber-50 text-amber-800 ring-amber-200",
  erro: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  brand: "bg-accent-100 text-brand-700 ring-accent-200",
};

const mapaPadrao: Record<string, Tom> = {
  em_estoque: "sucesso",
  reservado: "aviso",
  vendido: "info",
  devolvido: "neutro",
  inativo: "neutro",
  aguardando_chegada: "brand",
  pendente: "aviso",
  paga: "sucesso",
  cancelada: "erro",
  devolvida: "neutro",
  ativo: "sucesso",
  sucesso: "sucesso",
  erro: "erro",
  parcial: "aviso",
  em_andamento: "info",
  novo: "sucesso",
  seminovo: "info",
  usado: "neutro",
  defeituoso: "erro",
  brasil: "brand",
  europa: "info",
  outros: "neutro",
  fisica: "neutro",
  juridica: "info",
  entrada: "sucesso",
  saida: "erro",
  transferencia: "info",
  reserva: "aviso",
  venda: "info",
  devolucao: "neutro",
  cancelamento: "erro",
  ajuste: "brand",
  importado_tiny: "info",
  manual: "neutro",
  tiny: "info",
  importacao_planilha: "brand",
  api: "info",
};

interface StatusBadgeProps {
  value: string | null | undefined;
  tom?: Tom;
  label?: string;
  className?: string;
}

export function StatusBadge({ value, tom, label, className }: StatusBadgeProps) {
  if (!value) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
          mapaTom.neutro,
          className,
        )}
      >
        —
      </span>
    );
  }
  const tomFinal = tom ?? mapaPadrao[value] ?? "neutro";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        mapaTom[tomFinal],
        className,
      )}
    >
      {label ?? traduzirEnum(value)}
    </span>
  );
}
