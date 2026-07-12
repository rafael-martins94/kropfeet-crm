import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { DateRangePicker } from "../../components/DateRangePicker";
import { EntityLink } from "../../components/EntityLink";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { StatusSelectDropdown } from "../../components/StatusSelectDropdown";
import { IconEdit, IconEye, IconPlus, IconShoe } from "../../components/Icons";
import {
  skusDaVenda,
  VendaItensModal,
} from "../../components/vendas/VendaItensModal";
import { vendasService, type VendaDetalhada } from "../../services/vendas";
import { clientesService } from "../../services/clientes";
import { useAsync } from "../../hooks/useAsync";
import {
  useVendasFiltros,
  type ColunaOrdemVenda,
} from "../../hooks/useVendasFiltros";
import { formatarData, formatarMoeda, traduzirEnum } from "../../utils/format";
import { cn } from "../../utils/cn";
import type { StatusVenda } from "../../types/entities";
import {
  lerMarcadores,
  moedaDaVenda,
  parseRegiaoVendaRota,
  type MarcadorVenda,
} from "./vendaOpcoes";
import { useState } from "react";

const statusOpcoes: Array<{ value: StatusVenda | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "em_aberto", label: "Em aberto" },
  { value: "pago", label: "Pago" },
  { value: "preparando_envio", label: "Preparando envio" },
  { value: "enviado", label: "Enviado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

function CabecalhoOrdenavel({
  label,
  coluna,
  colunaAtiva,
  ascendente,
  onOrdem,
  className,
}: {
  label: string;
  coluna: ColunaOrdemVenda;
  colunaAtiva: ColunaOrdemVenda;
  ascendente: boolean;
  onOrdem: (c: ColunaOrdemVenda) => void;
  className?: string;
}) {
  const ativo = colunaAtiva === coluna;
  return (
    <button
      type="button"
      className={cn(
        "-mx-2 -my-1 inline-flex w-full items-center gap-x-1.5 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider transition-colors",
        ativo ? "text-ink" : "text-ink-soft hover:bg-brand-50/60 hover:text-ink",
        className,
      )}
      onClick={() => onOrdem(coluna)}
    >
      <span className="leading-snug">{label}</span>
      {ativo ? (
        <span className="shrink-0 text-brand-600" aria-hidden>
          {ascendente ? "↑" : "↓"}
        </span>
      ) : (
        <span className="shrink-0 opacity-35" aria-hidden>
          ↕
        </span>
      )}
    </button>
  );
}

function TagsVenda({ marcadores }: { marcadores: MarcadorVenda[] }) {
  if (marcadores.length === 0) {
    return <span className="text-ink-faint">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {marcadores.map((m, i) => (
        <span
          key={m.id ?? `${m.descricao}-${i}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-[11px] text-ink"
          title={m.descricao}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: m.cor || "#808080" }}
          />
          <span className="truncate">{m.descricao}</span>
        </span>
      ))}
    </div>
  );
}

function SkusVenda({ venda }: { venda: VendaDetalhada }) {
  const skus = skusDaVenda(venda);
  if (skus.length === 0) {
    return <span className="text-ink-faint">—</span>;
  }

  const visiveis = skus.slice(0, 3);
  const resto = skus.length - visiveis.length;

  return (
    <div className="min-w-0" title={skus.join(", ")}>
      <div className="font-numeric truncate text-sm tabular-nums text-ink">
        {visiveis.join(", ")}
      </div>
      {resto > 0 ? (
        <div className="text-[11px] text-ink-soft">
          +{resto} SKU{resto === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}

export default function VendasListPage() {
  const { pathname } = useLocation();
  const segmento = pathname.split("/").filter(Boolean).pop();
  const regiao = parseRegiaoVendaRota(segmento);
  const navigate = useNavigate();
  const filtros = useVendasFiltros();
  const [vendaItensModal, setVendaItensModal] = useState<VendaDetalhada | null>(null);

  const { data, loading, error } = useAsync(
    () =>
      regiao
        ? vendasService.listarComRelacoes({
            page: filtros.page,
            pageSize: 20,
            status: filtros.status,
            search: filtros.searchDebounced,
            regiao,
            marcador: filtros.marcadorDebounced,
            sku: filtros.skuDebounced,
            dataDe: filtros.dataDe,
            dataAte: filtros.dataAte,
            orderBy: filtros.colunaOrdem,
            ascending: filtros.ordemAscendente,
          })
        : Promise.resolve(null),
    [
      filtros.page,
      filtros.status,
      filtros.searchDebounced,
      regiao,
      filtros.marcadorDebounced,
      filtros.skuDebounced,
      filtros.dataDe,
      filtros.dataAte,
      filtros.colunaOrdem,
      filtros.ordemAscendente,
    ],
  );

  if (!regiao) {
    return <Navigate to="/vendas" replace />;
  }

  const labelRegiao = traduzirEnum(regiao);

  const columns: Column<VendaDetalhada>[] = [
    {
      key: "numero",
      header: (
        <CabecalhoOrdenavel
          label="Pedido"
          coluna="numero"
          colunaAtiva={filtros.colunaOrdem}
          ascendente={filtros.ordemAscendente}
          onOrdem={filtros.alterarOrdem}
        />
      ),
      width: "110px",
      render: (v) => (
        <EntityLink
          to={`/vendas/${v.id}`}
          appearance="plain"
          className="font-numeric tabular-nums text-sm font-medium"
        >
          {v.numero ?? "—"}
        </EntityLink>
      ),
    },
    {
      key: "cliente",
      header: (
        <CabecalhoOrdenavel
          label="Cliente"
          coluna="nome_cliente"
          colunaAtiva={filtros.colunaOrdem}
          ascendente={filtros.ordemAscendente}
          onOrdem={filtros.alterarOrdem}
        />
      ),
      width: "220px",
      render: (v) => {
        const principal = v.cliente
          ? clientesService.resolverEnderecoPrincipal(v.cliente)
          : null;
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">
              {v.cliente?.nome ?? v.nome_cliente ?? (
                <span className="text-ink-faint">—</span>
              )}
            </div>
            {principal?.cidade || principal?.uf ? (
              <div className="truncate text-xs text-ink-soft">
                {[principal.cidade, principal.uf].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "sku",
      header: "SKU",
      width: "160px",
      render: (v) => <SkusVenda venda={v} />,
    },
    {
      key: "tags",
      header: "Tags",
      render: (v) => <TagsVenda marcadores={lerMarcadores(v.marcadores)} />,
    },
    {
      key: "data",
      header: (
        <CabecalhoOrdenavel
          label="Data"
          coluna="data_pedido"
          colunaAtiva={filtros.colunaOrdem}
          ascendente={filtros.ordemAscendente}
          onOrdem={filtros.alterarOrdem}
        />
      ),
      width: "110px",
      render: (v) => (
        <span className="text-xs text-ink-soft">{formatarData(v.data_pedido)}</span>
      ),
    },
    {
      key: "total",
      header: (
        <CabecalhoOrdenavel
          label="Total"
          coluna="valor_total"
          colunaAtiva={filtros.colunaOrdem}
          ascendente={filtros.ordemAscendente}
          onOrdem={filtros.alterarOrdem}
          className="justify-end"
        />
      ),
      width: "130px",
      className: "text-right",
      render: (v) => (
        <span className="font-numeric tabular-nums text-sm">
          {formatarMoeda(Number(v.valor_total), moedaDaVenda(v))}
        </span>
      ),
    },
    {
      key: "status",
      header: (
        <CabecalhoOrdenavel
          label="Status"
          coluna="status_venda"
          colunaAtiva={filtros.colunaOrdem}
          ascendente={filtros.ordemAscendente}
          onOrdem={filtros.alterarOrdem}
        />
      ),
      width: "140px",
      render: (v) => <StatusBadge value={v.status_venda} />,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "128px",
      className: "text-right",
      render: (v) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            className="btn-ghost h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setVendaItensModal(v);
            }}
            aria-label="Ver itens da ordem"
            title="Ver itens"
          >
            <IconShoe width={16} height={16} />
          </button>
          <button
            type="button"
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/vendas/${v.id}`)}
            aria-label="Ver ordem"
          >
            <IconEye width={16} height={16} />
          </button>
          <button
            type="button"
            className="btn-ghost h-8 w-8 p-0"
            onClick={() => navigate(`/vendas/${v.id}/editar`)}
            aria-label="Editar ordem"
          >
            <IconEdit width={16} height={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title={`Ordens de venda · ${labelRegiao}`}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Ordens de venda", to: "/vendas" },
          { label: labelRegiao },
        ]}
        backTo="/vendas"
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate(`/vendas/novo?regiao=${regiao}`)}
          >
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
            <div className="flex min-w-0 items-center gap-2 border-b border-line px-5 py-3">
              <input
                value={filtros.search}
                onChange={(e) => filtros.setSearch(e.target.value)}
                placeholder="Nº, cliente ou rastreamento…"
                className="input-base min-w-0 flex-[0.9]"
              />
              <input
                value={filtros.sku}
                onChange={(e) => filtros.setSku(e.target.value)}
                placeholder="SKU…"
                className="input-base w-[5.5rem] shrink-0 font-numeric"
              />
              <DateRangePicker
                value={{ de: filtros.dataDe, ate: filtros.dataAte }}
                onChange={({ de, ate }) => filtros.setPeriodo(de, ate)}
                placeholder="Data do pedido"
                className="min-w-0 flex-[1.1]"
              />
              <StatusSelectDropdown
                value={filtros.status}
                options={statusOpcoes}
                onChange={(v) => filtros.setStatus(v as StatusVenda | "")}
                className="min-w-0 flex-1"
              />
              <input
                value={filtros.marcador}
                onChange={(e) => filtros.setMarcador(e.target.value)}
                placeholder="Tag…"
                className="input-base min-w-0 w-28 shrink grow-0 basis-28"
              />
              <div className="hidden shrink-0 whitespace-nowrap text-xs text-ink-soft xl:block">
                {data ? `${data.total.toLocaleString("pt-BR")} ordens` : ""}
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
                rowKey={(v) => v.id}
                loading={loading}
                tableClassName="table-fixed"
                emptyTitle="Nenhuma ordem de venda"
                emptyDescription={
                  filtros.dataDe || filtros.dataAte
                    ? `Nenhuma ordem no período selecionado em ${labelRegiao}.`
                    : filtros.sku
                    ? `Nenhuma ordem com SKU “${filtros.sku}” em ${labelRegiao}.`
                    : filtros.marcador
                      ? `Nenhuma ordem com a tag “${filtros.marcador}” em ${labelRegiao}.`
                      : `Não há pedidos em ${labelRegiao} ainda. Crie uma nova ordem ou importe do Tiny.`
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
                onPageChange={filtros.setPage}
              />
            ) : null
          }
        />
      </SectionCard>

      <VendaItensModal
        open={Boolean(vendaItensModal)}
        onClose={() => setVendaItensModal(null)}
        venda={vendaItensModal}
        moeda={vendaItensModal ? moedaDaVenda(vendaItensModal) : "BRL"}
      />
    </div>
  );
}
