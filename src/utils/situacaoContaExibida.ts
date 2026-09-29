import type { ContaReceber } from "../types/entities";

export type SituacaoExibida = "recebido" | "vencida" | "aberto" | "cancelado";

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dia(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return valor.slice(0, 10);
}

/** O que a tela mostra. Recebido no banco continua recebido. */
export function situacaoExibida(
  conta: Pick<ContaReceber, "situacao" | "data_vencimento">,
): SituacaoExibida {
  if (conta.situacao === "cancelado") return "cancelado";
  if (conta.situacao === "recebido") return "recebido";
  const vencimento = dia(conta.data_vencimento);
  if (vencimento && vencimento < hojeIso()) return "vencida";
  return "aberto";
}

export function contaContaComoRecebida(
  conta: Parameters<typeof situacaoExibida>[0],
): boolean {
  return situacaoExibida(conta) === "recebido";
}

/** Sem código SumUp, a situação pode ser marcada na ordem. Com código, a SumUp define. */
export function statusPodeSerAlteradoNaOrdem(codigo: string | null | undefined): boolean {
  return !codigo?.trim();
}

export function contaContaComoEmAberto(
  conta: Parameters<typeof situacaoExibida>[0],
): boolean {
  const exibida = situacaoExibida(conta);
  return exibida === "aberto" || exibida === "vencida";
}
