import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { EntityLink } from "../../components/EntityLink";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { PrecoVendaItem } from "../../components/itens-estoque/PrecoVendaItem";
import { ItensEstoqueFiltrosToolbar } from "../../components/itens-estoque/ItensEstoqueFiltrosToolbar";
import { ItensEstoqueHeaderControls } from "../../components/itens-estoque/ItensEstoqueHeaderControls";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton, SecondaryButton, DangerButton } from "../../components/PrimaryButton";
import { RowActionsDotsMenu } from "../../components/RowActionsDotsMenu";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { StatusItemFilterDropdown } from "../../components/StatusItemFilterDropdown";
import { IconArrowUpRight, IconEdit, IconEye, IconEyeOff, IconPlus, IconTrash } from "../../components/Icons";
import {
  itensEstoqueService,
  COLUNAS_ORDEM_ITEM_ESTOQUE,
  type ColunaOrdemItemEstoque,
  type ItemEstoqueDetalhado,
} from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { useItensEstoqueFiltros } from "../../hooks/useItensEstoqueFiltros";
import { useListDetailNavigation } from "../../hooks/useListDetailNavigation";
import { useToast } from "../../contexts/ToastContext";
import type { StatusItem } from "../../types/entities";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";
import {
  readEnumParam,
  useReplaceSearchParams,
  writeEnumParam,
  writeParam,
} from "../../utils/listUrlParams";
import {
  formatSizeLabel,
  getSecondaryEquivalenceLabelsAfterPrimary,
  getSizeByDisplaySystem,
  getUsDisplayLabel,
} from "../../utils/sizeConversion";

function CabecalhoOrdenavel({
  label,
  title,
  nowrap,
  coluna,
  colunaAtiva,
  ascendente,
  onOrdem,
}: {
  label: string;
  title?: string;
  nowrap?: boolean;
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
        "-mx-2 -my-1 inline-flex w-full items-center gap-x-1.5 gap-y-0.5 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider transition-colors",
        nowrap ? "flex-nowrap whitespace-nowrap" : "flex-wrap",
        ativo ? "text-ink" : "text-ink-soft hover:bg-brand-50/60 hover:text-ink",
      )}
      onClick={() => onOrdem(coluna)}
    >
      <span className={cn("leading-snug", nowrap && "whitespace-nowrap")}>{label}</span>
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
  const toast = useToast();
  const filtros = useItensEstoqueFiltros();
  const { toDetail } = useListDetailNavigation();
  const linkItem = (path: string) => toDetail(path);
  const [searchParams] = useSearchParams();
  const patchParams = useReplaceSearchParams();

  const colunaOrdem = readEnumParam(
    searchParams,
    "ordem",
    COLUNAS_ORDEM_ITEM_ESTOQUE,
    "atualizado_em",
  );
  const dirParam = searchParams.get("dir");
  const ordemAscendente =
    dirParam === "asc" ? true : dirParam === "desc" ? false : colunaOrdem !== "atualizado_em";

  const setOrdenacao = (coluna: ColunaOrdemItemEstoque, ascendente: boolean) => {
    patchParams((next) => {
      writeEnumParam(next, "ordem", coluna, "atualizado_em");
      if (coluna === "atualizado_em" && !ascendente) {
        next.delete("dir");
      } else {
        writeParam(next, "dir", ascendente ? "asc" : "desc");
      }
      next.delete("page");
    });
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [statusMassa, setStatusMassa] = useState<StatusItem>("em_estoque");
  const [aplicandoMassa, setAplicandoMassa] = useState(false);
  const [excluindoMassa, setExcluindoMassa] = useState(false);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [visivelCafeUpdatingId, setVisivelCafeUpdatingId] = useState<string | null>(null);
  const [visivelCafeOverrides, setVisivelCafeOverrides] = useState<Record<string, boolean>>({});

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
    if (colunaOrdem === coluna) {
      setOrdenacao(coluna, !ordemAscendente);
    } else {
      setOrdenacao(coluna, coluna === "atualizado_em" ? false : true);
    }
  };

  useEffect(() => {
    setVisivelCafeOverrides({});
  }, [data]);

  const rows = useMemo(() => {
    const base = data?.data ?? [];
    if (Object.keys(visivelCafeOverrides).length === 0) return base;
    return base.map((row) =>
      Object.prototype.hasOwnProperty.call(visivelCafeOverrides, row.id)
        ? { ...row, visivel_cafe: visivelCafeOverrides[row.id]! }
        : row,
    );
  }, [data, visivelCafeOverrides]);

  useEffect(() => {
    setSelectedIds(new Set());
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
  };

  const limparSelecao = () => {
    setSelectedIds(new Set());
  };

  const alterarStatusNaLinha = async (
    idItem: string,
    statusAtual: StatusItem,
    novo: StatusItem | "",
  ) => {
    if (novo === "" || novo === statusAtual) return;
    setStatusUpdatingId(idItem);
    try {
      await itensEstoqueService.atualizar(idItem, { status_item: novo });
      reload();
    } catch (e) {
      toast.erro(mensagemErro(e), "Erro ao atualizar status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const alternarVisivelCafeNaLinha = async (idItem: string, visivelAtual: boolean) => {
    const novo = !visivelAtual;
    setVisivelCafeUpdatingId(idItem);
    setVisivelCafeOverrides((prev) => ({ ...prev, [idItem]: novo }));
    try {
      await itensEstoqueService.atualizar(idItem, { visivel_cafe: novo });
    } catch (e) {
      setVisivelCafeOverrides((prev) => ({ ...prev, [idItem]: visivelAtual }));
      toast.erro(mensagemErro(e), "Erro ao atualizar vitrine");
    } finally {
      setVisivelCafeUpdatingId(null);
    }
  };

  const aplicarStatusEmMassa = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setAplicandoMassa(true);
    try {
      await itensEstoqueService.atualizarStatusEmMassa(ids, statusMassa);
      toast.sucesso(
        `Status atualizado em ${ids.length.toLocaleString("pt-BR")} item(ns).`,
      );
      limparSelecao();
      reload();
    } catch (e) {
      toast.erro(mensagemErro(e), "Erro na ação em massa");
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
    setExcluindoMassa(true);
    try {
      await itensEstoqueService.deletarEmMassa(ids);
      toast.sucesso(`${n.toLocaleString("pt-BR")} item(ns) excluído(s).`);
      limparSelecao();
      reload();
    } catch (e) {
      toast.erro(mensagemErro(e), "Erro ao excluir");
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
      render: (it) => {
        const detalhe = linkItem(`/itens-estoque/${it.id}`);
        return (
        <FotoThumbnailHover
          url={it.id_modelo_produto ? thumbs.data?.[it.id_modelo_produto] : null}
          alt={it.nome_produto}
          to={detalhe.to}
          linkState={detalhe.options}
        />
        );
      },
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
      render: (it) => {
        const detalhe = linkItem(`/itens-estoque/${it.id}`);
        return (
        <EntityLink
          to={detalhe.to}
          state={detalhe.options?.state}
          appearance="plain"
          truncate
          className="text-sm font-medium"
          title={it.nome_produto}
        >
          {it.nome_produto}
        </EntityLink>
        );
      },
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
      key: "visivel",
      header: (
        <CabecalhoOrdenavel
          label="Vis."
          title="Visível no KropCafé"
          coluna="visivel_cafe"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
          nowrap
        />
      ),
      headerClassName: "align-top whitespace-nowrap w-[4.5rem] px-1 text-center",
      width: "72px",
      className: "w-[4.5rem] shrink-0 px-1 text-center align-middle",
      render: (it) => {
        const visivel = it.visivel_cafe ?? true;
        const atualizando = visivelCafeUpdatingId === it.id;
        return (
          <button
            type="button"
            className={cn(
              "btn-ghost mx-auto inline-flex h-8 w-8 items-center justify-center p-0",
              visivel ? "text-emerald-700" : "text-ink-soft",
              atualizando && "opacity-50",
            )}
            disabled={atualizando}
            title={visivel ? "Visível no KropCafé — clique para ocultar" : "Oculto no KropCafé — clique para exibir"}
            aria-label={
              visivel
                ? `Ocultar ${it.sku} no catálogo KropCafé`
                : `Exibir ${it.sku} no catálogo KropCafé`
            }
            onClick={(e) => {
              e.stopPropagation();
              void alternarVisivelCafeNaLinha(it.id, visivel);
            }}
          >
            {visivel ? (
              <IconEye width={16} height={16} />
            ) : (
              <IconEyeOff width={16} height={16} />
            )}
          </button>
        );
      },
    },
    {
      key: "preco",
      header: (
        <CabecalhoOrdenavel
          label="Preço"
          coluna="preco_venda"
          colunaAtiva={colunaOrdem}
          ascendente={ordemAscendente}
          onOrdem={alterarOrdem}
          nowrap
        />
      ),
      headerClassName: "align-top whitespace-nowrap w-[6.5rem]",
      width: "104px",
      className: "whitespace-nowrap",
      render: (it) => (
        <PrecoVendaItem
          preco_venda={it.preco_venda}
          moeda_venda={it.moeda_venda}
          local={it.local}
        />
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
      width: "48px",
      className: "text-right",
      render: (it) => {
        const detalhe = linkItem(`/itens-estoque/${it.id}`);
        const editar = linkItem(`/itens-estoque/${it.id}/editar`);
        return (
          <RowActionsDotsMenu
            label={`Ações de ${it.sku}`}
            items={[
              {
                key: "ver",
                label: "Ver detalhes",
                icon: <IconArrowUpRight width={16} height={16} />,
                onClick: () => navigate(detalhe.to, detalhe.options),
              },
              {
                key: "editar",
                label: "Editar",
                icon: <IconEdit width={16} height={16} />,
                onClick: () => navigate(editar.to, editar.options),
              },
            ]}
          />
        );
      },
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
            }}
            regiaoEstoque={filtros.regiaoEstoque}
            onRegiaoEstoqueChange={(novaRegiao) => {
              filtros.setRegiaoEstoque(novaRegiao);
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
              }}
              status={filtros.status}
              onStatusChange={(v) => {
                filtros.setStatus(v);
              }}
              localEstoqueIds={filtros.localEstoqueIds}
              onLocalEstoqueIdsChange={(v) => {
                filtros.setLocalEstoqueIds(v);
              }}
              categoriaIds={filtros.categoriaIds}
              onCategoriaIdsChange={(v) => {
                filtros.setCategoriaIds(v);
              }}
              numeracaoFiltro={filtros.numeracaoFiltro}
              onNumeracaoFiltroChange={(v) => {
                filtros.setNumeracaoFiltro(v);
              }}
              opcoesLocalFiltro={filtros.opcoesLocalFiltro}
              opcoesCategoriaFiltro={filtros.opcoesCategoriaFiltro}
              locaisLoading={filtros.locaisLista.loading}
              categoriasLoading={filtros.categoriasLista.loading}
            />
          }
          banner={
            selectedIds.size > 0 ? (
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
              </div>
            ) : null
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
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
