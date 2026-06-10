import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "../../components/DataTable";
import { ItensEstoqueFiltrosToolbar } from "../../components/itens-estoque/ItensEstoqueFiltrosToolbar";
import { ItensEstoqueHeaderControls } from "../../components/itens-estoque/ItensEstoqueHeaderControls";
import { PageHeader } from "../../components/PageHeader";
import { SecondaryButton } from "../../components/PrimaryButton";
import { Pagination } from "../../components/Pagination";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { StatusBadge } from "../../components/StatusBadge";
import { IconCheck } from "../../components/Icons";
import {
  conferenciasEstoqueService,
  type ConferenciaHojeInfo,
} from "../../services/conferencias-estoque";
import {
  itensEstoqueService,
  type ItemEstoqueDetalhado,
} from "../../services/itens-estoque";
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
import { ConferenciaHistoricoModal } from "./ConferenciaHistoricoModal";

export default function ConferenciaEstoquePage() {
  const filtros = useItensEstoqueFiltros();
  const { perfil, user } = useAuth();
  const nomeUsuarioAtual =
    perfil?.nome?.trim() || (user?.user_metadata?.["nome"] as string | undefined) || null;

  const [locaisPorItem, setLocaisPorItem] = useState<Record<string, string>>({});
  const [statusPorItem, setStatusPorItem] = useState<Record<string, StatusItem>>({});
  const [conferidosHoje, setConferidosHoje] = useState<Map<string, ConferenciaHojeInfo>>(
    () => new Map(),
  );
  const [conferindoId, setConferindoId] = useState<string | null>(null);
  const [localUpdatingId, setLocalUpdatingId] = useState<string | null>(null);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [situacaoConferencia, setSituacaoConferencia] = useState<SituacaoConferenciaFiltro>("");
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const paramsListagem = useMemo(
    () => ({
      ...filtros.paramsListagem,
      idCategoria: undefined,
      situacaoConferencia: situacaoConferencia || undefined,
    }),
    [filtros.paramsListagem, situacaoConferencia],
  );

  const { data, loading, error } = useAsync(
    () =>
      itensEstoqueService.listarComRelacoes({
        page: filtros.page,
        pageSize: 50,
        ...paramsListagem,
        ordenacao: { coluna: "sku", ascendente: true },
      }),
    [filtros.page, paramsListagem],
  );

  const rows = data?.data ?? [];

  const rowsExibicao = useMemo(
    () =>
      rows.map((row) =>
        statusPorItem[row.id]
          ? { ...row, status_item: statusPorItem[row.id] }
          : row,
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

  const carregarConferidos = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setConferidosHoje(new Map());
      return;
    }
    try {
      const mapa = await conferenciasEstoqueService.mapaConferidosHoje(ids);
      setConferidosHoje((prev) => {
        const next = new Map<string, ConferenciaHojeInfo>();
        for (const id of ids) {
          const doServidor = mapa.get(id);
          if (doServidor) next.set(id, doServidor);
          else if (prev.has(id)) next.set(id, prev.get(id)!);
        }
        return next;
      });
    } catch {
      /* mantém mapa anterior em falha silenciosa de leitura */
    }
  }, []);

  useEffect(() => {
    void carregarConferidos(rows.map((r) => r.id));
  }, [rows, carregarConferidos]);

  const alterarLocalNaLinha = async (idItem: string, idLocal: string) => {
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
    if (conferidosHoje.has(item.id) || conferindoId === item.id) return;
    setErroInline(null);
    setConferindoId(item.id);

    const statusAnterior = item.status_item;
    const conferidoOtimista: ConferenciaHojeInfo = {
      id: "otimista",
      conferidoEm: new Date().toISOString(),
      idUsuario: user?.id ?? "",
      nomeUsuario: nomeUsuarioAtual,
      statusAnterior,
    };
    setConferidosHoje((prev) => new Map(prev).set(item.id, conferidoOtimista));
    aplicarStatusLocal(item.id, "em_estoque");

    try {
      const idLocal = locaisPorItem[item.id] ?? item.id_local_estoque ?? null;
      const idConferencia = await conferenciasEstoqueService.conferirItem(
        item.id,
        idLocal || null,
      );
      setConferidosHoje((prev) => {
        const next = new Map(prev);
        next.set(item.id, {
          ...conferidoOtimista,
          id: idConferencia,
        });
        return next;
      });
    } catch (e) {
      setConferidosHoje((prev) => {
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
    const conferido = conferidosHoje.get(item.id);
    if (!conferido || conferindoId === item.id) return;
    setErroInline(null);
    setConferindoId(item.id);

    const snapshotConferido = conferido;
    setConferidosHoje((prev) => {
      const next = new Map(prev);
      next.delete(item.id);
      return next;
    });
    aplicarStatusLocal(item.id, snapshotConferido.statusAnterior);

    try {
      await conferenciasEstoqueService.desfazerConferencia(item.id);
    } catch (e) {
      setConferidosHoje((prev) => new Map(prev).set(item.id, snapshotConferido));
      aplicarStatusLocal(item.id, "em_estoque");
      setErroInline(mensagemErro(e));
    } finally {
      setConferindoId(null);
    }
  };

  const alternarConferencia = (item: ItemEstoqueDetalhado) => {
    if (conferidosHoje.has(item.id)) {
      void desfazerConferencia(item);
    } else {
      void conferirItem(item);
    }
  };

  const columns: Column<ItemEstoqueDetalhado>[] = [
      {
        key: "check",
        header: <span className="sr-only">Conferir</span>,
        width: "56px",
        className: "align-middle",
        render: (it) => {
          const conferido = conferidosHoje.get(it.id);
          const emAndamento = conferindoId === it.id;
          const tooltip = conferido
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
                  !emAndamento && "hover:scale-105 hover:ring-2 hover:ring-emerald-300/60",
                )}
                title={tooltip}
                aria-label={`Conferido: ${it.sku}. Clique para desfazer.`}
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Conferência de estoque"
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
        breadcrumbs={[{ label: "Operação" }, { label: "Conferência de estoque" }]}
        actions={
          <SecondaryButton type="button" onClick={() => setHistoricoAberto(true)}>
            Histórico de conferências
          </SecondaryButton>
        }
      />

      <ConferenciaHistoricoModal
        open={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
      />

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
                loading={loading}
                emptyTitle="Nenhum item encontrado"
                onRowClick={alternarConferencia}
                rowClassName={(it) =>
                  cn(
                    "cursor-pointer hover:bg-surface-muted/60",
                    conferidosHoje.has(it.id) && "bg-emerald-50/40 hover:bg-emerald-50/60",
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
