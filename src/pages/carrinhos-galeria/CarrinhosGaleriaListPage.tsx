import { useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { EntityLink } from "../../components/EntityLink";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import {
  carrinhosGaleriaService,
  type CarrinhoGaleriaLista,
  type SituacaoCarrinhoGaleria,
} from "../../services/carrinhos-galeria";
import { formatarDataHora, formatarMoeda } from "../../utils/format";
import { cn } from "../../utils/cn";

const filtros: Array<{ id: SituacaoCarrinhoGaleria; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "salvo", label: "Salvos" },
  { id: "com_ordem", label: "Com ordem de venda" },
];

function contagemDoFiltro(
  id: SituacaoCarrinhoGaleria,
  salvos: number,
  comOrdem: number,
  total: number,
) {
  if (id === "salvo") return salvos;
  if (id === "com_ordem") return comOrdem;
  return salvos + comOrdem || total;
}

export default function CarrinhosGaleriaListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCarrinhoGaleria>("todos");
  const searchDebounced = useDebounce(search, 300);

  const { data, loading, error } = useAsync(
    () =>
      carrinhosGaleriaService.listar({
        page,
        pageSize: 20,
        search: searchDebounced,
        situacao,
      }),
    [page, searchDebounced, situacao],
  );

  const columns: Column<CarrinhoGaleriaLista>[] = [
    {
      key: "quando",
      header: "Salvo em",
      width: "150px",
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-ink-soft">{formatarDataHora(row.criado_em)}</span>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      render: (row) => (
        <div className="min-w-0">
          <EntityLink to={`/clientes/${row.id_cliente}`} appearance="plain" truncate className="font-medium">
            {row.cliente?.nome ?? "Cliente"}
          </EntityLink>
          <div className="truncate text-xs text-ink-soft">
            {[row.cliente?.telefone, row.cliente?.pais].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "itens",
      header: "Pares",
      render: (row) =>
        row.itens.length === 0 ? (
          <span className="text-sm text-ink-soft">—</span>
        ) : (
          <ul className="min-w-0 space-y-0.5">
            {row.itens.map((item, index) => (
              <li key={`${item.sku ?? "par"}-${index}`} className="truncate text-sm text-ink">
                <span className="font-medium">{item.sku || "Par"}</span>
                {item.numeracao ? <span className="text-ink-soft"> · {item.numeracao}</span> : null}
                {item.preco ? <span className="text-ink-soft"> · {item.preco}</span> : null}
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "situacao",
      header: "Situação",
      width: "150px",
      render: (row) => (
        <StatusBadge
          value={row.id_venda ? "com_ordem" : "salvo"}
          label={row.id_venda ? "Ordem gerada" : "Salvo"}
          tom={row.id_venda ? "sucesso" : "aviso"}
        />
      ),
    },
    {
      key: "ordem",
      header: "Ordem",
      width: "160px",
      render: (row) =>
        row.venda ? (
          <div className="min-w-0">
            <EntityLink to={`/vendas/${row.venda.id}`} appearance="plain" truncate className="font-medium">
              {row.venda.numero || "Ver ordem"}
            </EntityLink>
            <div className="text-xs text-ink-soft">
              {formatarMoeda(row.venda.valor_total, "EUR")}
            </div>
          </div>
        ) : (
          <span className="text-sm text-ink-soft">—</span>
        ),
    },
  ];

  const vazio =
    situacao === "salvo"
      ? {
          title: "Nenhum carrinho só salvo",
          description: "Aqui ficam as seleções da galeria que ainda não geraram ordem de venda.",
        }
      : situacao === "com_ordem"
        ? {
            title: "Nenhum carrinho com ordem",
            description: "Aqui ficam as seleções da galeria que já geraram uma ordem de venda.",
          }
        : {
            title: "Nenhum carrinho da galeria",
            description: "Quando uma seleção for salva no catálogo, ela aparece nesta lista.",
          };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Carrinhos galeria"
        breadcrumbs={[{ label: "Comercial" }, { label: "Carrinhos galeria" }]}
      />

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  {filtros.map((filtro) => {
                    const ativo = situacao === filtro.id;
                    const quantidade = data
                      ? contagemDoFiltro(filtro.id, data.salvos, data.comOrdem, data.total)
                      : null;
                    return (
                      <button
                        key={filtro.id}
                        type="button"
                        onClick={() => {
                          setSituacao(filtro.id);
                          setPage(1);
                        }}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition",
                          ativo
                            ? "bg-brand-600 text-white"
                            : "bg-surface-subtle text-ink-muted hover:text-brand-700",
                        )}
                      >
                        {filtro.label}
                        {quantidade != null ? (
                          <span
                            className={cn(
                              "rounded-full px-1.5 text-xs tabular-nums",
                              ativo ? "bg-white/20 text-white" : "bg-white text-ink-soft",
                            )}
                          >
                            {quantidade}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <SearchInput
                  placeholder="Buscar cliente, telefone ou SKU…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  wrapperClassName="w-full sm:w-72"
                />
              </div>
            </div>
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={data?.data ?? []}
                rowKey={(row) => row.id}
                loading={loading}
                emptyTitle={searchDebounced ? "Nenhum carrinho encontrado" : vazio.title}
                emptyDescription={
                  searchDebounced
                    ? "Tente outro nome, telefone ou SKU."
                    : vazio.description
                }
              />
            )
          }
          footer={
            data ? (
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
