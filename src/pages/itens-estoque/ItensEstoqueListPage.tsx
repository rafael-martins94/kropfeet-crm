import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { ItensEstoqueFiltrosToolbar } from "../../components/itens-estoque/ItensEstoqueFiltrosToolbar";
import { ItensEstoqueHeaderControls } from "../../components/itens-estoque/ItensEstoqueHeaderControls";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton, SecondaryButton, DangerButton } from "../../components/PrimaryButton";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusItemFilterDropdown } from "../../components/StatusItemFilterDropdown";
import { IconEdit, IconEye, IconPlus, IconTrash } from "../../components/Icons";
import {
  itensEstoqueService,
  type ColunaOrdemItemEstoque,
  type ItemEstoqueDetalhado,
} from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { useItensEstoqueFiltros } from "../../hooks/useItensEstoqueFiltros";
import type { StatusItem } from "../../types/entities";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";
import {
  formatSizeLabel,
  getSecondaryEquivalenceLabelsAfterPrimary,
  getSizeByDisplaySystem,
  getUsDisplayLabel,
} from "../../utils/sizeConversion";

function FotoProduto({
  url,
  nome,
  to,
}: {
  url: string | null | undefined;
  nome: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0"
      title={nome}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-subtle">
        {url ? (
          <img
            src={url}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-ink-faint" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </span>
        )}
      </span>
    </Link>
  );
}

function CabecalhoOrdenavel({
  label,
  title,
  coluna,
  colunaAtiva,
  ascendente,
  onOrdem,
}: {
  label: string;
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

export default function ItensEstoqueListPage() {
  const navigate = useNavigate();
  const filtros = useItensEstoqueFiltros();

  const [colunaOrdem, setColunaOrdem] = useState<ColunaOrdemItemEstoque>("atualizado_em");
  const [ordemAscendente, setOrdemAscendente] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [statusMassa, setStatusMassa] = useState<StatusItem>("em_estoque");
  const [aplicandoMassa, setAplicandoMassa] = useState(false);
  const [excluindoMassa, setExcluindoMassa] = useState(false);
  const [erroMassa, setErroMassa] = useState<string | null>(null);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [erroStatusInline, setErroStatusInline] = useState<string | null>(null);

  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const { data, loading, error, reload } = useAsync(
    () =>
      itensEstoqueService.listarComRelacoes({
        page: filtros.page,
        pageSize: 50,
        ...filtros.paramsListagem,
        ordenacao: { coluna: colunaOrdem, ascendente: ordemAscendente },
      }),
    [
      filtros.page,
      filtros.paramsListagem,
      colunaOrdem,
      ordemAscendente,
    ],
  );

  const alterarOrdem = (coluna: ColunaOrdemItemEstoque) => {
    filtros.resetPage();
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
  }, [filtros.paramsListagem]);

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
      key: "foto",
      header: <span className="sr-only">Foto</span>,
      headerClassName: "w-[4.5rem] px-2",
      width: "72px",
      className: "w-[4.5rem] shrink-0 px-2 align-middle",
      render: (it) => (
        <FotoProduto
          url={it.id_modelo_produto ? thumbs.data?.[it.id_modelo_produto] : null}
          nome={it.nome_produto}
          to={`/itens-estoque/${it.id}`}
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
      headerClassName: "align-top whitespace-normal w-[5.5rem] px-2",
      width: "88px",
      className: "w-[5.5rem] shrink-0 px-2",
      render: (it) => (
        <span className="block truncate font-numeric tabular-nums text-xs">{it.sku}</span>
      ),
    },
    {
      key: "produto",
      header: (
        <CabecalhoOrdenavel
          label="Produto"
          coluna="nome_produto"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
        />
      ),
      headerClassName: "align-top whitespace-normal min-w-[14rem] max-w-[min(42vw,22rem)]",
      className: "min-w-[14rem] max-w-[min(42vw,22rem)]",
      render: (it) => (
        <Link
          to={`/itens-estoque/${it.id}`}
          className="block truncate text-sm font-medium text-ink hover:text-brand-700"
          title={it.nome_produto}
        >
          {it.nome_produto}
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
        const principal =
          filtros.displaySizeSystem === "us"
            ? getUsDisplayLabel(it)
            : formatSizeLabel(
                getSizeByDisplaySystem(it, filtros.displaySizeSystem),
                filtros.displaySizeSystem,
              );
        const secundarias = getSecondaryEquivalenceLabelsAfterPrimary(
          filtros.displaySizeSystem,
          it,
        );
        const tooltipEq = secundarias.length > 0 ? secundarias.join(" • ") : undefined;

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
          <ItensEstoqueHeaderControls
            displaySizeSystem={filtros.displaySizeSystem}
            onDisplaySizeSystemChange={(v) => {
              filtros.setDisplaySizeSystem(v);
              filtros.resetPage();
            }}
            regiaoEstoque={filtros.regiaoEstoque}
            onRegiaoEstoqueChange={(novaRegiao) => {
              filtros.setRegiaoEstoque(novaRegiao);
              filtros.aplicarFiltroLocaisPorRegiao(novaRegiao);
              filtros.resetPage();
            }}
          />
        }
        breadcrumbs={[{ label: "Catálogo" }, { label: "Itens de estoque" }]}
        actions={
          <PrimaryButton
            icon={<IconPlus width={16} height={16} />}
            onClick={() => navigate("/ordens-compra/novo")}
          >
            Nova ordem de compra
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
            <ItensEstoqueFiltrosToolbar
              search={filtros.search}
              onSearchChange={(v) => {
                filtros.setSearch(v);
                filtros.resetPage();
              }}
              status={filtros.status}
              onStatusChange={(v) => {
                filtros.setStatus(v);
                filtros.resetPage();
              }}
              localEstoqueIds={filtros.localEstoqueIds}
              onLocalEstoqueIdsChange={(v) => {
                filtros.setLocalEstoqueIds(v);
                filtros.resetPage();
              }}
              categoriaIds={filtros.categoriaIds}
              onCategoriaIdsChange={(v) => {
                filtros.setCategoriaIds(v);
                filtros.resetPage();
              }}
              numeracaoFiltro={filtros.numeracaoFiltro}
              onNumeracaoFiltroChange={(v) => {
                filtros.setNumeracaoFiltro(v);
                filtros.resetPage();
              }}
              opcoesLocalFiltro={filtros.opcoesLocalFiltro}
              opcoesCategoriaFiltro={filtros.opcoesCategoriaFiltro}
              locaisLoading={filtros.locaisLista.loading}
              categoriasLoading={filtros.categoriasLista.loading}
            />
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
                onPageChange={filtros.setPage}
              />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}
