import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PrecoVendaItem } from "../../components/itens-estoque/PrecoVendaItem";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { ItensEstoqueFiltrosToolbar } from "../../components/itens-estoque/ItensEstoqueFiltrosToolbar";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { Pagination } from "../../components/Pagination";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { StatusBadge } from "../../components/StatusBadge";
import { IconCheck } from "../../components/Icons";
import {
  conferenciasEstoqueService,
  type ConferenciaItemInfo,
  type ConferenciaResumo,
} from "../../services/conferencias-estoque";
import {
  itensEstoqueService,
  type ItemEstoqueDetalhado,
} from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { useAsync } from "../../hooks/useAsync";
import { useItensEstoqueFiltros } from "../../hooks/useItensEstoqueFiltros";
import { useAuth } from "../../contexts/AuthContext";
import type { StatusItem } from "../../types/entities";
import type { SituacaoConferenciaFiltro } from "../../services/conferencias-estoque";
import { cn } from "../../utils/cn";
import { formatarDataHora } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";
import {
  formatSizeLabel,
  getSecondaryEquivalenceLabelsAfterPrimary,
  getSizeByDisplaySystem,
  getUsDisplayLabel,
} from "../../utils/sizeConversion";

export default function ConferenciaEstoquePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const filtros = useItensEstoqueFiltros();
  const { perfil, user } = useAuth();
  const nomeUsuarioAtual =
    perfil?.nome?.trim() || (user?.user_metadata?.["nome"] as string | undefined) || null;

  const [locaisPorItem, setLocaisPorItem] = useState<Record<string, string>>({});
  const [statusPorItem, setStatusPorItem] = useState<Record<string, StatusItem>>({});
  const [conferidos, setConferidos] = useState<Map<string, ConferenciaItemInfo>>(() => new Map());
  const [conferindoId, setConferindoId] = useState<string | null>(null);
  const [localUpdatingId, setLocalUpdatingId] = useState<string | null>(null);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [situacaoConferencia, setSituacaoConferencia] = useState<SituacaoConferenciaFiltro>("");
  const [fechando, setFechando] = useState(false);
  const [conferenciaLocal, setConferenciaLocal] = useState<ConferenciaResumo | null>(null);

  const {
    data: conferencia,
    loading: loadingConferencia,
    error: erroConferencia,
    reload: recarregarConferencia,
  } = useAsync(
    () => (id ? conferenciasEstoqueService.obter(id) : Promise.resolve(null)),
    [id],
  );

  useEffect(() => {
    if (conferencia) setConferenciaLocal(conferencia);
  }, [conferencia]);

  const conferenciaAberta = conferenciaLocal?.status === "aberta";

  const paramsListagem = useMemo(
    () => ({
      ...filtros.paramsListagem,
      idCategoria: undefined,
      regiaoEstoque: undefined,
      situacaoConferencia: situacaoConferencia || undefined,
      idConferencia: id,
    }),
    [filtros.paramsListagem, situacaoConferencia, id],
  );

  const { data, loading, error } = useAsync(
    () =>
      id
        ? itensEstoqueService.listarComRelacoes({
            page: filtros.page,
            pageSize: 50,
            ...paramsListagem,
            ordenacao: { coluna: "sku", ascendente: true },
          })
        : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 50 }),
    [filtros.page, paramsListagem, id],
  );

  const rows = data?.data ?? [];

  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const rowsExibicao = useMemo(
    () =>
      rows.map((row) =>
        statusPorItem[row.id] ? { ...row, status_item: statusPorItem[row.id] } : row,
      ),
    [rows, statusPorItem],
  );

  useEffect(() => {
    setLocaisPorItem({});
    setStatusPorItem({});
  }, [paramsListagem, filtros.page]);

  useEffect(() => {
    setLocaisPorItem((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!(row.id in next)) {
          next[row.id] = row.id_local_estoque ?? "";
        }
      }
      return next;
    });
  }, [rows]);

  const carregarConferidos = useCallback(
    async (ids: string[]) => {
      if (!id || ids.length === 0) {
        setConferidos(new Map());
        return;
      }
      try {
        const mapa = await conferenciasEstoqueService.mapaConferidosNaConferencia(ids, id);
        setConferidos((prev) => {
          const next = new Map<string, ConferenciaItemInfo>();
          for (const itemId of ids) {
            const doServidor = mapa.get(itemId);
            if (doServidor) next.set(itemId, doServidor);
            else if (prev.has(itemId)) next.set(itemId, prev.get(itemId)!);
          }
          return next;
        });
      } catch {
        /* mantém mapa anterior em falha silenciosa de leitura */
      }
    },
    [id],
  );

  useEffect(() => {
    void carregarConferidos(rows.map((r) => r.id));
  }, [rows, carregarConferidos]);

  const alterarLocalNaLinha = async (idItem: string, idLocal: string) => {
    if (!conferenciaAberta) return;
    setLocaisPorItem((prev) => ({ ...prev, [idItem]: idLocal }));
    setErroInline(null);
    setLocalUpdatingId(idItem);
    try {
      await itensEstoqueService.atualizar(idItem, {
        id_local_estoque: idLocal || null,
      });
    } catch (e) {
      setErroInline(mensagemErro(e));
      setLocaisPorItem((prev) => {
        const row = rows.find((r) => r.id === idItem);
        return { ...prev, [idItem]: row?.id_local_estoque ?? "" };
      });
    } finally {
      setLocalUpdatingId(null);
    }
  };

  const aplicarStatusLocal = (idItem: string, status: StatusItem | null) => {
    const statusOriginal = rows.find((r) => r.id === idItem)?.status_item;
    setStatusPorItem((prev) => {
      const next = { ...prev };
      if (status === null || status === statusOriginal) {
        delete next[idItem];
      } else {
        next[idItem] = status;
      }
      return next;
    });
  };

  const conferirItem = async (item: ItemEstoqueDetalhado) => {
    if (!id || !conferenciaAberta || conferidos.has(item.id) || conferindoId === item.id) return;
    setErroInline(null);
    setConferindoId(item.id);

    const statusAnterior = item.status_item;
    const conferidoOtimista: ConferenciaItemInfo = {
      id: "otimista",
      conferidoEm: new Date().toISOString(),
      idUsuario: user?.id ?? "",
      nomeUsuario: nomeUsuarioAtual,
      statusAnterior,
    };
    setConferidos((prev) => new Map(prev).set(item.id, conferidoOtimista));
    aplicarStatusLocal(item.id, "em_estoque");

    try {
      const idLocal = locaisPorItem[item.id] ?? item.id_local_estoque ?? null;
      const idConferenciaItem = await conferenciasEstoqueService.conferirItem(
        item.id,
        id,
        idLocal || null,
      );
      setConferidos((prev) => {
        const next = new Map(prev);
        next.set(item.id, {
          ...conferidoOtimista,
          id: idConferenciaItem,
        });
        return next;
      });
      setConferenciaLocal((prev) =>
        prev ? { ...prev, totalItensConferidos: prev.totalItensConferidos + 1 } : prev,
      );
    } catch (e) {
      setConferidos((prev) => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
      aplicarStatusLocal(item.id, null);
      setErroInline(mensagemErro(e));
    } finally {
      setConferindoId(null);
    }
  };

  const desfazerConferencia = async (item: ItemEstoqueDetalhado) => {
    if (!id || !conferenciaAberta) return;
    const conferido = conferidos.get(item.id);
    if (!conferido || conferindoId === item.id) return;
    setErroInline(null);
    setConferindoId(item.id);

    const snapshotConferido = conferido;
    setConferidos((prev) => {
      const next = new Map(prev);
      next.delete(item.id);
      return next;
    });
    aplicarStatusLocal(item.id, snapshotConferido.statusAnterior);

    try {
      await conferenciasEstoqueService.desfazerConferencia(item.id, id);
      setConferenciaLocal((prev) =>
        prev
          ? { ...prev, totalItensConferidos: Math.max(0, prev.totalItensConferidos - 1) }
          : prev,
      );
    } catch (e) {
      setConferidos((prev) => new Map(prev).set(item.id, snapshotConferido));
      aplicarStatusLocal(item.id, "em_estoque");
      setErroInline(mensagemErro(e));
    } finally {
      setConferindoId(null);
    }
  };

  const alternarConferencia = (item: ItemEstoqueDetalhado) => {
    if (!conferenciaAberta) return;
    if (conferidos.has(item.id)) {
      void desfazerConferencia(item);
    } else {
      void conferirItem(item);
    }
  };

  const fecharConferencia = async () => {
    if (!id || !conferenciaAberta || fechando) return;
    const confirmar = window.confirm(
      "Fechar esta conferência? Depois de fechada, não será mais possível conferir ou desfazer itens.",
    );
    if (!confirmar) return;

    setFechando(true);
    setErroInline(null);
    try {
      await conferenciasEstoqueService.fechar(id);
      setConferenciaLocal((prev) =>
        prev ? { ...prev, status: "fechada", fechado_em: new Date().toISOString() } : prev,
      );
      recarregarConferencia();
    } catch (e) {
      setErroInline(mensagemErro(e));
    } finally {
      setFechando(false);
    }
  };

  const columns: Column<ItemEstoqueDetalhado>[] = [
    {
      key: "check",
      header: <span className="sr-only">Conferir</span>,
      width: "56px",
      className: "align-middle",
      render: (it) => {
        const conferido = conferidos.get(it.id);
        const emAndamento = conferindoId === it.id;
        const tooltip = !conferenciaAberta
          ? "Conferência fechada"
          : conferido
            ? `Conferido ${formatarDataHora(conferido.conferidoEm)}${
                conferido.nomeUsuario ? ` por ${conferido.nomeUsuario}` : ""
              }. Clique para desfazer.`
            : "Clique na linha para conferir";

        if (conferido) {
          return (
            <div
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30 transition-transform",
                emAndamento && "animate-pulse opacity-70",
                conferenciaAberta && !emAndamento && "hover:scale-105 hover:ring-2 hover:ring-emerald-300/60",
              )}
              title={tooltip}
              aria-label={`Conferido: ${it.sku}. ${conferenciaAberta ? "Clique para desfazer." : ""}`}
            >
              <IconCheck width={20} height={20} strokeWidth={2.6} />
            </div>
          );
        }

        return (
          <span
            className={cn(
              "inline-block h-10 w-10 rounded-full bg-zinc-300 ring-1 ring-zinc-400/40",
              emAndamento && "animate-pulse opacity-70",
            )}
            title={tooltip}
            aria-hidden
          />
        );
      },
    },
    {
      key: "foto",
      header: <span className="sr-only">Foto</span>,
      headerClassName: "w-[4.5rem] px-2",
      width: "72px",
      className: "w-[4.5rem] shrink-0 px-2 align-middle",
      render: (it) => (
        <FotoThumbnailHover
          url={it.id_modelo_produto ? thumbs.data?.[it.id_modelo_produto] : null}
          alt={it.nome_produto}
          to={`/itens-estoque/${it.id}`}
        />
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: "118px",
      render: (it) => (
        <span className="block max-w-[7rem] truncate font-numeric tabular-nums text-xs">{it.sku}</span>
      ),
    },
    {
      key: "produto",
      header: "Produto",
      headerClassName: "min-w-[11rem]",
      className: "min-w-[11rem] max-w-[min(34vw,17rem)]",
      render: (it) => (
        <span className="block truncate text-sm font-medium text-ink" title={it.nome_produto}>
          {it.nome_produto}
        </span>
      ),
    },
    {
      key: "numeracao",
      header: "NUM",
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
      key: "preco",
      header: "Preço",
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
      header: "Local",
      headerClassName: "min-w-[11rem]",
      className: "min-w-[11rem]",
      render: (it) => (
        <div className="min-w-[10rem]" onClick={(e) => e.stopPropagation()}>
          <SearchableSelectDropdown
            value={locaisPorItem[it.id] ?? it.id_local_estoque ?? ""}
            options={filtros.opcoesLocalLinha}
            loading={localUpdatingId === it.id}
            searchPlaceholder="Buscar local…"
            triggerClassName="w-full min-w-0"
            className="w-full min-w-0"
            disabled={!conferenciaAberta}
            onChange={(v) => {
              void alterarLocalNaLinha(it.id, v);
            }}
          />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "140px",
      render: (it) => <StatusBadge value={it.status_item} />,
    },
  ];

  if (!id) {
    return (
      <div className="p-5 text-sm text-red-700">
        Conferência não informada.{" "}
        <Link to="/conferencia-estoque" className="underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  if (erroConferencia) {
    return <div className="p-5 text-sm text-red-700">Erro: {erroConferencia.message}</div>;
  }

  if (!loadingConferencia && !conferencia) {
    return (
      <div className="p-5 text-sm text-ink-muted">
        Conferência não encontrada.{" "}
        <Link to="/conferencia-estoque" className="text-brand-600 underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  const titulo = conferenciaLocal?.nome ?? "Conferência";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title={titulo}
        titleAccessory={
          conferenciaLocal ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={conferenciaLocal.status} />
              <span className="text-sm text-ink-soft">
                {conferenciaLocal.totalItensConferidos.toLocaleString("pt-BR")} itens conferidos
              </span>
            </div>
          ) : null
        }
        breadcrumbs={[
          { label: "Operação" },
          { label: "Conferência de estoque", to: "/conferencia-estoque" },
          { label: titulo },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton type="button" onClick={() => navigate("/conferencia-estoque")}>
              Voltar
            </SecondaryButton>
            {conferenciaAberta ? (
              <DangerButton type="button" loading={fechando} onClick={() => void fecharConferencia()}>
                Fechar conferência
              </DangerButton>
            ) : null}
          </div>
        }
      />

      {!conferenciaAberta ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Esta conferência está fechada. Os itens conferidos permanecem registrados, mas não é possível
          conferir ou desfazer itens.
        </div>
      ) : null}

      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <ItensEstoqueFiltrosToolbar
              variant="conferencia"
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
              situacaoConferencia={situacaoConferencia}
              onSituacaoConferenciaChange={(v) => {
                setSituacaoConferencia(v);
                filtros.resetPage();
              }}
              numeracaoFiltro={filtros.numeracaoFiltro}
              onNumeracaoFiltroChange={(v) => {
                filtros.setNumeracaoFiltro(v);
                filtros.resetPage();
              }}
              opcoesLocalFiltro={filtros.opcoesLocalFiltro}
              locaisLoading={filtros.locaisLista.loading}
            />
          }
          banner={
            erroInline ? (
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 text-sm text-red-900">
                <span className="min-w-0 pt-0.5">{erroInline}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-900 underline-offset-2 hover:underline"
                  onClick={() => setErroInline(null)}
                >
                  Fechar
                </button>
              </div>
            ) : null
          }
          body={
            error ? (
              <div className="p-5 text-sm text-red-700">Erro: {error.message}</div>
            ) : (
              <DataTable
                columns={columns}
                rows={rowsExibicao}
                rowKey={(it) => it.id}
                loading={loading || loadingConferencia}
                emptyTitle="Nenhum item encontrado"
                onRowClick={conferenciaAberta ? alternarConferencia : undefined}
                rowClassName={(it) =>
                  cn(
                    conferenciaAberta && "cursor-pointer hover:bg-surface-muted/60",
                    conferidos.has(it.id) && "bg-emerald-50/40 hover:bg-emerald-50/60",
                  )
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
    </div>
  );
}
