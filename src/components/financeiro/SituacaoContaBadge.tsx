import { StatusBadge } from "../StatusBadge";
import type { ContaReceber } from "../../types/entities";
import { formatarData } from "../../utils/format";
import { situacaoExibida } from "../../utils/situacaoContaExibida";

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function contaEstaVencida(
  conta: Pick<ContaReceber, "situacao" | "data_vencimento">,
): boolean {
  return Boolean(
    conta.situacao === "aberto" && conta.data_vencimento && conta.data_vencimento < hojeIso(),
  );
}

export function SituacaoContaBadge({
  conta,
}: {
  conta: Pick<
    ContaReceber,
    | "situacao"
    | "data_vencimento"
    | "data_recebimento"
    | "divergente"
    | "motivo_divergencia"
    | "origem_baixa"
    | "forma_pagamento"
    | "meio_pagamento"
    | "codigo_transacao"
    | "criado_em"
    | "atualizado_em"
  >;
}) {
  if (conta.divergente) {
    return (
      <span title={conta.motivo_divergencia ?? undefined}>
        <StatusBadge value="divergente" label="Divergente" tom="laranja" />
      </span>
    );
  }
  const exibida = situacaoExibida(conta);
  if (exibida === "recebido") {
    return (
      <span title={`Recebido em ${formatarData(conta.data_recebimento)}`}>
        <StatusBadge value="recebido" label="Recebido" />
      </span>
    );
  }
  if (exibida === "cancelado") {
    return <StatusBadge value="cancelado" label="Cancelada" />;
  }
  return exibida === "vencida" ? (
    <StatusBadge value="vencida" label="Vencida" tom="erro" />
  ) : (
    <StatusBadge value="aberto" label="Em aberto" />
  );
}
