import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type Column } from "../DataTable";
import { Modal } from "../Modal";
import { LoadingState } from "../LoadingState";
import { SecondaryButton } from "../PrimaryButton";
import { StatusBadge } from "../StatusBadge";
import { Pagination } from "../Pagination";
import { useAsync } from "../../hooks/useAsync";
import {
  itensEstoqueService,
  type ItemEstoqueStatusHistorico,
} from "../../services/itens-estoque";
import { formatarDataHora } from "../../utils/format";

function rotuloOrigemStatus(origem: string): string {
  switch (origem) {
    case "manual":
      return "Manual";
    case "venda":
      return "Ordem de venda";
    case "tiny":
      return "Tiny";
    case "sistema":
      return "Sistema";
    default:
      return origem;
  }
}

type MovimentacoesStatusModalProps = {
  open: boolean;
  onClose: () => void;
  /** Se informado, filtra só este item */
  idItemEstoque?: string | null;
  sku?: string | null;
};

export function MovimentacoesStatusModal({
  open,
  onClose,
  idItemEstoque,
  sku,
}: MovimentacoesStatusModalProps) {
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const historico = useAsync(
    () =>
      open
        ? itensEstoqueService.listarMovimentacoesStatus({
            page,
            pageSize,
            idItem: idItemEstoque ?? null,
          })
        : Promise.resolve({ data: [], total: 0, page: 1, pageSize }),
    [open, page, pageSize, idItemEstoque],
  );

  const columns: Column<ItemEstoqueStatusHistorico>[] = [
    {
      key: "data",
      header: "Data",
      width: "150px",
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-ink">{formatarDataHora(row.criado_em)}</span>
      ),
    },
    ...(idItemEstoque
      ? []
      : [
          {
            key: "item",
            header: "Item",
            render: (row: ItemEstoqueStatusHistorico) => (
              <Link
                to={`/itens-estoque/${row.id_item_estoque}`}
                className="font-medium text-ink hover:text-brand-700"
                onClick={onClose}
              >
                <span className="font-numeric text-xs text-ink-muted">SKU {row.sku ?? "—"}</span>
                <span className="mt-0.5 block truncate text-sm">{row.nome_produto ?? "—"}</span>
              </Link>
            ),
          } satisfies Column<ItemEstoqueStatusHistorico>,
        ]),
    {
      key: "de",
      header: "De",
      render: (row) =>
        row.status_anterior ? <StatusBadge value={row.status_anterior} /> : <span className="text-ink-faint">—</span>,
    },
    {
      key: "para",
      header: "Para",
      render: (row) => <StatusBadge value={row.status_novo} />,
    },
    {
      key: "usuario",
      header: "Usuário",
      render: (row) => <span className="text-sm text-ink-soft">{row.nome_usuario ?? "—"}</span>,
    },
    {
      key: "origem",
      header: "Origem",
      render: (row) => <span className="text-sm text-ink-soft">{rotuloOrigemStatus(row.origem)}</span>,
    },
    {
      key: "venda",
      header: "OV",
      render: (row) =>
        row.id_venda ? (
          <Link
            to={`/vendas/${row.id_venda}`}
            className="font-numeric text-sm font-medium text-brand-700 hover:underline"
            onClick={onClose}
          >
            #{row.numero_venda ?? "—"}
          </Link>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

          const total = historico.data?.total ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      className="max-w-5xl"
      title="Movimentações de status"
      description={
        idItemEstoque
          ? `Alterações de status${sku ? ` do SKU ${sku}` : ""}`
          : "Histórico recente de mudanças de status dos itens de estoque"
      }
      footer={<SecondaryButton onClick={onClose}>Fechar</SecondaryButton>}
    >
      <div className="space-y-4">
        {historico.loading ? (
          <LoadingState label="Carregando movimentações…" />
        ) : historico.error ? (
          <p className="text-sm text-red-700">{historico.error.message}</p>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={historico.data?.data ?? []}
              rowKey={(row) => row.id}
              emptyTitle="Nenhuma movimentação registrada"
              emptyDescription="Quando o status de um item mudar, a alteração aparecerá aqui."
              tableClassName="min-w-[720px]"
            />
            {total > pageSize ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
