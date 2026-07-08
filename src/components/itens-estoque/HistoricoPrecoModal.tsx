import type { ReactNode } from "react";
import { DataTable, type Column } from "../DataTable";
import { Modal } from "../Modal";
import { LoadingState } from "../LoadingState";
import { SecondaryButton } from "../PrimaryButton";
import { useAsync } from "../../hooks/useAsync";
import { itensEstoqueService, type ItemEstoquePrecoHistorico } from "../../services/itens-estoque";
import { formatarDataHora, formatarMoeda } from "../../utils/format";
import { montarPontosGraficoPreco, rotuloOrigemPreco } from "../../utils/historicoPreco";
import { cn } from "../../utils/cn";
import { GraficoPrecoHistorico } from "./GraficoPrecoHistorico";

type HistoricoPrecoModalProps = {
  open: boolean;
  onClose: () => void;
  idItemEstoque: string;
  sku?: string;
  precoAtual?: number | null;
  moedaAtual?: string | null;
};

function formatarVariacao(anterior: number | null, novo: number | null, moeda: string | null): ReactNode {
  if (anterior == null || novo == null) return "—";
  const delta = novo - anterior;
  if (delta === 0) return <span className="text-ink-soft">Sem variação</span>;
  const positivo = delta > 0;
  return (
    <span className={cn("font-numeric font-semibold tabular-nums", positivo ? "text-red-700" : "text-emerald-700")}>
      {positivo ? "+" : ""}
      {formatarMoeda(delta, moeda ?? "EUR")}
    </span>
  );
}

export function HistoricoPrecoModal({
  open,
  onClose,
  idItemEstoque,
  sku,
  precoAtual,
  moedaAtual,
}: HistoricoPrecoModalProps) {
  const historico = useAsync(
    () => (open ? itensEstoqueService.listarHistoricoPrecoVenda(idItemEstoque) : Promise.resolve([])),
    [open, idItemEstoque],
  );

  const pontos = montarPontosGraficoPreco(historico.data ?? [], precoAtual, moedaAtual);

  const columns: Column<ItemEstoquePrecoHistorico>[] = [
    {
      key: "data",
      header: "Data",
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-ink">{formatarDataHora(row.criado_em)}</span>
      ),
    },
    {
      key: "de",
      header: "De",
      render: (row) => (
        <span className="font-numeric text-sm tabular-nums text-ink-muted">
          {row.preco_anterior != null
            ? formatarMoeda(row.preco_anterior, row.moeda_anterior ?? row.moeda_nova ?? "EUR")
            : "—"}
        </span>
      ),
    },
    {
      key: "para",
      header: "Para",
      render: (row) => (
        <span className="font-numeric text-sm font-semibold tabular-nums text-ink">
          {row.preco_novo != null
            ? formatarMoeda(row.preco_novo, row.moeda_nova ?? row.moeda_anterior ?? "EUR")
            : "—"}
        </span>
      ),
    },
    {
      key: "variacao",
      header: "Variação",
      render: (row) =>
        formatarVariacao(row.preco_anterior, row.preco_novo, row.moeda_nova ?? row.moeda_anterior),
    },
    {
      key: "origem",
      header: "Origem",
      render: (row) => <span className="text-sm text-ink-soft">{rotuloOrigemPreco(row.origem)}</span>,
    },
    {
      key: "usuario",
      header: "Usuário",
      render: (row) => (
        <span className="text-sm text-ink-soft">{row.nome_usuario ?? "—"}</span>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      className="max-w-4xl"
      title="Histórico de preço"
      description={
        sku
          ? `Alterações registradas para o SKU ${sku}${
              precoAtual != null && moedaAtual
                ? ` · preço atual ${formatarMoeda(precoAtual, moedaAtual)}`
                : ""
            }`
          : "Alterações registradas de preço de venda"
      }
      footer={<SecondaryButton onClick={onClose}>Fechar</SecondaryButton>}
    >
      <div className="space-y-5">
        {historico.loading ? (
          <LoadingState label="Carregando histórico…" />
        ) : historico.error ? (
          <p className="text-sm text-red-700">{historico.error.message}</p>
        ) : (
          <>
            <GraficoPrecoHistorico pontos={pontos} moedaPadrao={moedaAtual} />
            <div>
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                Registros de alteração
              </p>
              <DataTable
                columns={columns}
                rows={historico.data ?? []}
                rowKey={(row) => row.id}
                emptyTitle="Nenhuma alteração registrada"
                emptyDescription="Quando o preço for editado, as mudanças aparecerão aqui."
                tableClassName="min-w-[640px]"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
