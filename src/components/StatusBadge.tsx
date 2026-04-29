import { cn } from "../utils/cn";
import { traduzirEnum } from "../utils/format";

type Tom =
  | "neutro"
  | "sucesso"
  | "aviso"
  | "erro"
  | "info"
  | "brand"
  /** Tons extra para distinguir status de item e outros enums sem repetir verde/azul/cinza. */
  | "violeta"
  | "rosa"
  | "laranja"
  | "teal"
  | "zinco"
  /** Verde mais escuro que `sucesso` — ex.: vendido vs em estoque. */
  | "verde_escuro";

const mapaTom: Record<Tom, string> = {
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
  sucesso: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  aviso: "bg-amber-50 text-amber-900 ring-amber-200",
  erro: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  brand: "bg-accent-100 text-brand-700 ring-accent-200",
  violeta: "bg-violet-50 text-violet-900 ring-violet-200",
  rosa: "bg-rose-50 text-rose-800 ring-rose-200",
  laranja: "bg-orange-50 text-orange-900 ring-orange-200",
  teal: "bg-teal-50 text-teal-900 ring-teal-200",
  zinco: "bg-zinc-200 text-zinc-800 ring-zinc-400",
  verde_escuro: "bg-emerald-200 text-emerald-950 ring-emerald-500/35",
};

const mapaPadrao: Record<string, Tom> = {
  em_estoque: "sucesso",
  fora_de_estoque: "erro",
  reservado: "violeta",
  vendido: "verde_escuro",
  devolvido: "neutro",
  inativo: "zinco",
  em_processo_de_compra: "laranja",
  pendente: "aviso",
  paga: "sucesso",
  cancelada: "erro",
  devolvida: "neutro",
  ativo: "sucesso",
  sucesso: "sucesso",
  erro: "erro",
  parcial: "aviso",
  em_andamento: "info",
  brasil: "brand",
  europa: "info",
  outros: "neutro",
  fisica: "neutro",
  juridica: "info",
  entrada: "sucesso",
  saida: "erro",
  transferencia: "teal",
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

/** Mesmas classes do `StatusBadge` para um valor de status de item (filtros, dropdowns). */
export function pillClassesForStatusItem(valor: string | undefined): string {
  if (!valor || valor === "") return mapaTom.neutro;
  const tomFinal = mapaPadrao[valor] ?? "neutro";
  return mapaTom[tomFinal];
}

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
