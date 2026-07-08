import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { IconPlus } from "../../components/Icons";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { fornecedoresService } from "../../services/fornecedores";
import { modelosProdutoService } from "../../services/modelos-produto";
import { ordensCompraService, type OrdemCompraDetalhada } from "../../services/ordens-compra";
import { cn } from "../../utils/cn";
import { formatarMoeda } from "../../utils/format";

function FiltroCampo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 w-full flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function OrdensCompraListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sku, setSku] = useState("");
  const [produto, setProduto] = useState("");
  const [idsFornecedor, setIdsFornecedor] = useState<string[]>([]);

  const skuDebounced = useDebounce(sku, 400);
  const produtoDebounced = useDebounce(produto, 400);

  const fornecedores = useAsync(() => fornecedoresService.listarAtivos(), []);
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const opcoesFornecedor = useMemo(
    () => [
      { value: "", label: "Todos os fornecedores" },
      ...(fornecedores.data ?? []).map((f) => ({
        value: f.id,
        label: f.nome,
      })),
    ],
    [fornecedores.data],
  );

  const { data, loading, error } = useAsync(
    () =>
      ordensCompraService.listar({
        page,
        pageSize: 25,
        sku: skuDebounced,
        produto: produtoDebounced,
        idFornecedor: idsFornecedor.length > 0 ? idsFornecedor : undefined,
      }),
    [page, skuDebounced, produtoDebounced, idsFornecedor],
  );

  const columns: Column<OrdemCompraDetalhada>[] = [
    {
      key: "foto",
      header: <span className="sr-only">Foto</span>,
      headerClassName: "w-[4.5rem] px-2",
      width: "72px",
      className: "w-[4.5rem] shrink-0 px-2 align-middle",
      render: (o) => (
        <FotoThumbnailHover
          url={
            o.item?.id_modelo_produto ? thumbs.data?.[o.item.id_modelo_produto] : null
          }
          alt={o.item?.nome_produto ?? "Produto"}
        />
      ),
    },
    {
      key: "sku",
      header: "SKU",
      headerClassName: "align-top whitespace-normal w-[5.5rem] px-2",
      width: "88px",
      className: "w-[5.5rem] shrink-0 px-2",
      render: (o) => (
        <span className="font-numeric tabular-nums text-sm text-ink">
          {o.item?.sku ?? "—"}
        </span>
      ),
    },
    {
      key: "produto",
      header: "Produto",
      headerClassName: "align-top whitespace-normal min-w-[14rem] max-w-[min(42vw,22rem)]",
      className: "min-w-[14rem] max-w-[min(42vw,22rem)]",
      render: (o) => (
        <span
          className="block truncate text-sm font-medium text-ink"
          title={o.item?.nome_produto ?? undefined}
        >
          {o.item?.nome_produto ?? "—"}
        </span>
      ),
    },
    {
      key: "fornecedor",
      header: "Fornecedor",
      render: (o) => (
        <span className="block truncate text-ink-soft">
          {o.fornecedor?.nome ?? "—"}
        </span>
      ),
    },
    {
      key: "cod_fornecedor",
      header: "Cód. fornecedor",
      width: "140px",
      render: (o) => (
        <span className="font-numeric tabular-nums text-sm text-ink-soft">
          {o.item?.codigo_fornecedor ?? "—"}
        </span>
      ),
    },
    {
      key: "valor",
      header: "Valor custo",
      width: "140px",
      render: (o) => (
        <span className="font-numeric tabular-nums text-sm">
          {formatarMoeda(o.valor_custo, o.moeda_compra)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status item",
      width: "160px",
      render: (o) => (o.item ? <StatusBadge value={o.item.status_item} /> : "—"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Ordens de compra"
        breadcrumbs={[{ label: "Operação" }, { label: "Ordens de compra" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} onClick={() => navigate("/ordens-compra/novo")}>
            Nova ordem
          </PrimaryButton>
        }
      />

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="border-b border-line px-5 py-4">
              <div
                className={cn(
                  "grid min-w-0 items-end gap-x-3 gap-y-4",
                  "[grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]",
                  "lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_auto]",
                )}
              >
                <FiltroCampo label="SKU">
                  <SearchInput
                    placeholder="Filtrar por SKU…"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      setPage(1);
                    }}
                    wrapperClassName="min-w-0 w-full"
                  />
                </FiltroCampo>
                <FiltroCampo label="Produto">
                  <SearchInput
                    placeholder="Filtrar por nome do tênis…"
                    value={produto}
                    onChange={(e) => {
                      setProduto(e.target.value);
                      setPage(1);
                    }}
                    wrapperClassName="min-w-0 w-full"
                  />
                </FiltroCampo>
                <SearchableSelectDropdown
                  multiple
                  label="Fornecedor"
                  value={idsFornecedor}
                  options={opcoesFornecedor}
                  emptyLabel="Todos os fornecedores"
                  loading={fornecedores.loading}
                  searchPlaceholder="Buscar fornecedor…"
                  triggerClassName="w-full min-w-0"
                  className="min-w-0 w-full"
                  onChange={(value) => {
                    setIdsFornecedor(value);
                    setPage(1);
                  }}
                />
                <div className="flex items-end justify-end pb-2 text-xs text-ink-soft lg:pb-0 lg:pl-2">
                  {data ? `${data.total.toLocaleString("pt-BR")} ordens` : ""}
                </div>
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
                rowKey={(o) => o.id}
                loading={loading}
                onRowClick={(o) => navigate(`/ordens-compra/${o.id}`)}
                rowClassName={() => "hover:bg-surface-muted/60"}
                emptyTitle="Nenhuma ordem de compra encontrada"
                emptyDescription={
                  skuDebounced || produtoDebounced || idsFornecedor.length > 0
                    ? "Tente ajustar os filtros de SKU, produto ou fornecedor."
                    : undefined
                }
              />
            )
          }
          footer={
            data ? (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
