import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton, SecondaryButton, DangerButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { StatusItemFilterDropdown } from "../../components/StatusItemFilterDropdown";
import { IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons";
import {
  FILTRO_CATEGORIA_SEM,
  FILTRO_LOCAL_SEM,
  itensEstoqueService,
  type ColunaOrdemItemEstoque,
  type ItemEstoqueDetalhado,
} from "../../services/itens-estoque";
import { categoriasService } from "../../services/categorias";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import type { StatusItem } from "../../types/entities";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";
import {
  formatSizeLabel,
  getAllSizeEquivalences,
  getSizeByDisplaySystem,
  type DisplaySizeSystem,
} from "../../utils/sizeConversion";

function CabecalhoOrdenavel({
  label,
  title,
  coluna,
  colunaAtiva,
  ascendente,
  onOrdem,
}: {
  label: string;
  /** Tooltip opcional (ex.: cabeçalho abreviado). */
  title?: string;
  coluna: ColunaOrdemItemEstoque;
  colunaAtiva: ColunaOrdemItemEstoque;
  ascendente: boolean;
  onOrdem: (c: ColunaOrdemItemEstoque) => void;
}) {
  const ativo = colunaAtiva === coluna;
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "-mx-2 -my-1 inline-flex w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider transition-colors",
        ativo ? "text-ink" : "text-ink-soft hover:bg-brand-50/60 hover:text-ink",
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

const statusOpcoes: Array<{ value: StatusItem | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "em_estoque", label: "Em estoque" },
  { value: "fora_de_estoque", label: "Fora de estoque" },
  { value: "em_processo_de_compra", label: "Em processo de compra" },
  { value: "transferencia", label: "Transferência" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "devolvido", label: "Devolvido" },
  { value: "inativo", label: "Inativo" },
];

const statusOpcoesAlteracao: Array<{ value: StatusItem; label: string }> = [
  { value: "em_estoque", label: "Em estoque" },
  { value: "fora_de_estoque", label: "Fora de estoque" },
  { value: "em_processo_de_compra", label: "Em processo de compra" },
  { value: "transferencia", label: "Transferência" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "devolvido", label: "Devolvido" },
  { value: "inativo", label: "Inativo" },
];

const padraoNumeracaoOpcoes: Array<{ value: DisplaySizeSystem; label: string }> = [
  { value: "br", label: "BR" },
  { value: "eu", label: "EU" },
  { value: "us_m", label: "US M" },
  { value: "us_w", label: "US W" },
  { value: "us_y", label: "US Y" },
];

const sistemasNumeracao: DisplaySizeSystem[] = ["br", "eu", "us_m", "us_w", "us_y"];

export default function ItensEstoqueListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusItem | "">("");
  /** UUID da categoria, `FILTRO_CATEGORIA_SEM` ou "" para todas */
  const [categoriaId, setCategoriaId] = useState("");
  /** UUID do local de estoque ou `FILTRO_LOCAL_SEM` ou "" para todos */
  const [localEstoqueId, setLocalEstoqueId] = useState("");
  const [displaySizeSystem, setDisplaySizeSystem] = useState<DisplaySizeSystem>("br");
  const [numeracaoFiltro, setNumeracaoFiltro] = useState("");
  const searchDebounced = useDebounce(search, 400);
  const numeracaoFiltroDebounced = useDebounce(numeracaoFiltro, 250);

  const [colunaOrdem, setColunaOrdem] = useState<ColunaOrdemItemEstoque>("atualizado_em");
  const [ordemAscendente, setOrdemAscendente] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [statusMassa, setStatusMassa] = useState<StatusItem>("em_estoque");
  const [aplicandoMassa, setAplicandoMassa] = useState(false);
  const [excluindoMassa, setExcluindoMassa] = useState(false);
  const [erroMassa, setErroMassa] = useState<string | null>(null);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [erroStatusInline, setErroStatusInline] = useState<string | null>(null);

  const categoriasLista = useAsync(() => categoriasService.listarTodas(), []);
  const locaisLista = useAsync(() => locaisEstoqueService.listarTodos(), []);

  const opcoesCategoriaFiltro = useMemo(
    () => [
      { value: "", label: "Todas as categorias" },
      { value: FILTRO_CATEGORIA_SEM, label: "Sem categoria" },
      ...(categoriasLista.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categoriasLista.data],
  );

  const opcoesLocalFiltro = useMemo(
    () => [
      { value: "", label: "Todos os locais" },
      { value: FILTRO_LOCAL_SEM, label: "Sem local definido" },
      ...(locaisLista.data ?? []).map((l) => ({ value: l.id, label: l.nome })),
    ],
    [locaisLista.data],
  );

  const { data, loading, error, reload } = useAsync(
    () =>
      itensEstoqueService.listarComRelacoes({
        page,
        pageSize: 50,
        search: searchDebounced,
        status,
        idCategoria: categoriaId || undefined,
        idLocalEstoque: localEstoqueId || undefined,
        displaySizeSystem,
        numeracao: numeracaoFiltroDebounced,
        ordenacao: { coluna: colunaOrdem, ascendente: ordemAscendente },
      }),
    [
      page,
      searchDebounced,
      status,
      categoriaId,
      localEstoqueId,
      displaySizeSystem,
      numeracaoFiltroDebounced,
      colunaOrdem,
      ordemAscendente,
    ],
  );

  const alterarOrdem = (coluna: ColunaOrdemItemEstoque) => {
    setPage(1);
    if (colunaOrdem === coluna) {
      setOrdemAscendente((a) => !a);
    } else {
      setColunaOrdem(coluna);
      setOrdemAscendente(coluna === "atualizado_em" ? false : true);
    }
  };

  const rows = data?.data ?? [];

  useEffect(() => {
    setSelectedIds(new Set());
    setErroMassa(null);
    setErroStatusInline(null);
  }, [searchDebounced, status, categoriaId, localEstoqueId, displaySizeSystem, numeracaoFiltroDebounced]);

  const idsPaginaAtual = useMemo(() => rows.map((r) => r.id), [rows]);
  const qtdSelecionadosPagina = useMemo(
    () => idsPaginaAtual.filter((id) => selectedIds.has(id)).length,
    [idsPaginaAtual, selectedIds],
  );
  const todosDaPaginaSelecionados =
    idsPaginaAtual.length > 0 && qtdSelecionadosPagina === idsPaginaAtual.length;

  const alternarId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErroMassa(null);
  };

  const alternarPaginaInteira = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (todosDaPaginaSelecionados) {
        for (const id of idsPaginaAtual) next.delete(id);
      } else {
        for (const id of idsPaginaAtual) next.add(id);
      }
      return next;
    });
    setErroMassa(null);
  };

  const limparSelecao = () => {
    setSelectedIds(new Set());
    setErroMassa(null);
  };

  const alterarStatusNaLinha = async (
    idItem: string,
    statusAtual: StatusItem,
    novo: StatusItem | "",
  ) => {
    if (novo === "" || novo === statusAtual) return;
    setErroStatusInline(null);
    setStatusUpdatingId(idItem);
    try {
      await itensEstoqueService.atualizar(idItem, { status_item: novo });
      reload();
    } catch (e) {
      setErroStatusInline(mensagemErro(e));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const aplicarStatusEmMassa = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setErroMassa(null);
    setAplicandoMassa(true);
    try {
      await itensEstoqueService.atualizarStatusEmMassa(ids, statusMassa);
      limparSelecao();
      reload();
    } catch (e) {
      setErroMassa(mensagemErro(e));
    } finally {
      setAplicandoMassa(false);
    }
  };

  const exclusaoEmMassaComConfirmacao = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const n = ids.length;
    const ok = window.confirm(
      `Excluir permanentemente ${n.toLocaleString("pt-BR")} item(ns) de estoque?\n\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setErroMassa(null);
    setExcluindoMassa(true);
    try {
      await itensEstoqueService.deletarEmMassa(ids);
      limparSelecao();
      reload();
    } catch (e) {
      setErroMassa(mensagemErro(e));
    } finally {
      setExcluindoMassa(false);
    }
  };

  const acaoMassaEmAndamento = aplicandoMassa || excluindoMassa;

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = !todosDaPaginaSelecionados && qtdSelecionadosPagina > 0;
  }, [todosDaPaginaSelecionados, qtdSelecionadosPagina]);

  const columns: Column<ItemEstoqueDetalhado>[] = [
    {
      key: "sel",
      header: (
        <span className="inline-flex items-center justify-center">
          <input
            type="checkbox"
            ref={headerCheckboxRef}
            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/30"
            checked={todosDaPaginaSelecionados}
            onChange={alternarPaginaInteira}
            aria-label="Selecionar todos desta página"
          />
        </span>
      ),
      headerClassName: "w-10",
      width: "40px",
      className: "align-middle",
      render: (it) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/30"
          checked={selectedIds.has(it.id)}
          onChange={() => alternarId(it.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Selecionar ${it.sku}`}
        />
      ),
    },
    {
      key: "sku",
      header: (
        <CabecalhoOrdenavel
          label="SKU"
          coluna="sku"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
        />
      ),
      headerClassName: "align-top whitespace-normal",
      width: "118px",
      render: (it) => (
        <span className="block max-w-[7rem] truncate font-numeric tabular-nums text-xs">{it.sku}</span>
      ),
    },
    {
      key: "produto",
      header: (
        <CabecalhoOrdenavel
          label="Produto"
          coluna="nome_completo"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
        />
      ),
      headerClassName: "align-top whitespace-normal min-w-[11rem] max-w-[min(34vw,17rem)]",
      className: "min-w-[11rem] max-w-[min(34vw,17rem)]",
      render: (it) => (
        <Link
          to={`/itens-estoque/${it.id}`}
          className="block truncate text-sm font-medium text-ink hover:text-brand-700"
          title={it.nome_completo}
        >
          {it.nome_completo}
        </Link>
      ),
    },
    {
      key: "numeracao",
      header: (
        <CabecalhoOrdenavel
          label="NUM"
          title="Numeração"
          coluna="numeracao_br"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
        />
      ),
      headerClassName: "align-top whitespace-normal",
      width: "96px",
      render: (it) => {
        const principal = formatSizeLabel(
          getSizeByDisplaySystem(it, displaySizeSystem),
          displaySizeSystem,
        );
        const equivalencias = getAllSizeEquivalences(it);
        const secundarias = sistemasNumeracao
          .filter((sistema) => sistema !== displaySizeSystem)
          .map((sistema) => formatSizeLabel(equivalencias[sistema], sistema))
          .filter((label) => label !== "—");
        const tooltipEq =
          secundarias.length > 0 ? secundarias.join(" • ") : undefined;

        return (
          <span
            className={cn(
              "inline-block max-w-[6rem] truncate text-sm font-medium tabular-nums text-ink-muted",
              tooltipEq && "cursor-help",
            )}
            title={tooltipEq}
          >
            {principal}
          </span>
        );
      },
    },
    {
      key: "status",
      header: (
        <CabecalhoOrdenavel
          label="Status"
          coluna="status_item"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
        />
      ),
      headerClassName: "align-top whitespace-normal",
      width: "216px",
      render: (it) => (
        <div className="min-w-[11.5rem] w-full max-w-[13.5rem]" onClick={(e) => e.stopPropagation()}>
          <StatusItemFilterDropdown
            value={it.status_item}
            options={statusOpcoesAlteracao}
            disabled={statusUpdatingId === it.id}
            className="w-full min-w-0 sm:w-full"
            onChange={(novo) => {
              void alterarStatusNaLinha(it.id, it.status_item, novo);
            }}
          />
        </div>
      ),
    },
    {
      key: "local",
      header: (
        <CabecalhoOrdenavel
          label="Local"
          coluna="local_nome"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
        />
      ),
      headerClassName: "align-top whitespace-normal max-w-[8rem]",
      className: "max-w-[8rem]",
      render: (it) => (
        <span className="block truncate text-ink-soft" title={it.local?.nome ?? undefined}>
          {it.local?.nome ?? "—"}
        </span>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: "96px",
      className: "text-right",
      render: (it) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/itens-estoque/${it.id}`)}><IconEye width={16} height={16} /></button>
          <button className="btn-ghost h-8 w-8 p-0" onClick={() => navigate(`/itens-estoque/${it.id}/editar`)}><IconEdit width={16} height={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Itens de estoque"
        titleAccessory={
          <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft shadow-sm">
            <span>Padrão</span>
            <select
              value={displaySizeSystem}
              onChange={(e) => {
                setDisplaySizeSystem(e.target.value as DisplaySizeSystem);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-ink outline-none"
              aria-label="Padrão de numeração"
            >
              {padraoNumeracaoOpcoes.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </select>
          </label>
        }
        breadcrumbs={[{ label: "Catálogo" }, { label: "Itens de estoque" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/itens-estoque/novo")}
          >
            Novo item
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
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div
                className={cn(
                  "grid min-w-0 flex-1 gap-x-3 gap-y-4 items-end",
                  "[grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]",
                  "lg:[grid-template-columns:minmax(11rem,1.35fr)_minmax(9rem,0.92fr)_minmax(10rem,1fr)_minmax(11.5rem,1.48fr)_minmax(7rem,0.68fr)] lg:grid-rows-1",
                )}
              >
                <SearchInput
                  placeholder="Buscar por SKU, nome completo, código…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  wrapperClassName="w-full min-w-0"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Status
                  </span>
                  <StatusItemFilterDropdown
                    value={status}
                    options={statusOpcoes}
                    className="w-full"
                    onChange={(v) => {
                      setStatus(v);
                      setPage(1);
                    }}
                  />
                </div>
                <SearchableSelectDropdown
                  label="Local de estoque"
                  value={localEstoqueId}
                  options={opcoesLocalFiltro}
                  loading={locaisLista.loading}
                  searchPlaceholder="Buscar local…"
                  triggerClassName="w-full min-w-0"
                  onChange={(v) => {
                    setLocalEstoqueId(v);
                    setPage(1);
                  }}
                  className="w-full min-w-0 max-w-[13rem]"
                />
                <SearchableSelectDropdown
                  label="Categoria (modelo)"
                  value={categoriaId}
                  options={opcoesCategoriaFiltro}
                  loading={categoriasLista.loading}
                  searchPlaceholder="Buscar categoria…"
                  triggerClassName="w-full min-w-0"
                  onChange={(v) => {
                    setCategoriaId(v);
                    setPage(1);
                  }}
                  className="w-full min-w-[12rem]"
                />
                <div className="flex min-w-0 max-w-[9rem] flex-col gap-1.5 lg:max-w-none">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Numeração
                  </span>
                  <SearchInput
                    placeholder="Ex.: US 6, BR37…"
                    value={numeracaoFiltro}
                    onChange={(e) => {
                      setNumeracaoFiltro(e.target.value);
                      setPage(1);
                    }}
                    wrapperClassName="w-full min-w-0"
                  />
                </div>
              </div>
              <div className="shrink-0 whitespace-nowrap pt-1 text-xs text-ink-soft sm:pt-0">
                {data ? `${data.total.toLocaleString("pt-BR")} itens` : ""}
              </div>
            </div>
          }
          banner={
            <>
              {erroStatusInline ? (
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 text-sm text-red-900">
                  <span className="min-w-0 pt-0.5">{erroStatusInline}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-900 underline-offset-2 hover:underline"
                    onClick={() => setErroStatusInline(null)}
                  >
                    Fechar
                  </button>
                </div>
              ) : null}
              {selectedIds.size > 0 ? (
              <div className="flex flex-col gap-3 border-b border-line bg-brand-500/[0.06] px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-ink">
                    {selectedIds.size.toLocaleString("pt-BR")} selecionado
                    {selectedIds.size !== 1 ? "s" : ""}
                  </span>
                  <label className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <span>Novo status:</span>
                    <select
                      value={statusMassa}
                      onChange={(e) => setStatusMassa(e.target.value as StatusItem)}
                      disabled={acaoMassaEmAndamento}
                      className="input-base w-auto min-w-[11rem] py-2 text-sm"
                    >
                      {statusOpcoesAlteracao.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={limparSelecao}
                    disabled={acaoMassaEmAndamento}
                  >
                    Limpar seleção
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    loading={aplicandoMassa}
                    disabled={acaoMassaEmAndamento}
                    onClick={aplicarStatusEmMassa}
                  >
                    Aplicar status
                  </PrimaryButton>
                  <DangerButton
                    type="button"
                    className="ml-auto"
                    icon={<IconTrash width={16} height={16} />}
                    loading={excluindoMassa}
                    disabled={acaoMassaEmAndamento}
                    onClick={exclusaoEmMassaComConfirmacao}
                  >
                    Excluir
                  </DangerButton>
                </div>
                {erroMassa ? (
                  <p className="w-full text-sm text-red-700 sm:order-last">{erroMassa}</p>
                ) : null}
              </div>
              ) : null}
            </>
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={data?.data ?? []}
                rowKey={(it) => it.id}
                loading={loading}
                emptyTitle="Nenhum item encontrado"
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
