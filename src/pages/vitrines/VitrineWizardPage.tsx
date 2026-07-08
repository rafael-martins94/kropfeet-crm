import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PrecoVendaEditavel } from "../../components/itens-estoque/PrecoVendaEditavel";
import { PrecoVendaItem } from "../../components/itens-estoque/PrecoVendaItem";
import { DataTable, type Column } from "../../components/DataTable";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { IconCheck, IconPlus, IconRefresh, IconX } from "../../components/Icons";
import { PageHeader } from "../../components/PageHeader";
import { VitrineTituloEditavel } from "../../components/vitrines/VitrineTituloEditavel";
import { Pagination } from "../../components/Pagination";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SearchInput } from "../../components/SearchInput";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { VitrinePdfDocument } from "../../components/vitrines/VitrinePdfDocument";
import {
  CaixaResumoCard,
  TOTAL_CAIXAS_VITRINE,
  formatarNumeracoes,
  fotoItemVitrine,
  fotoItemVitrinePdf,
  nomeModeloItemEstoque,
} from "../../components/vitrines/VitrineShared";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useVitrineSelecaoFiltros } from "../../hooks/useVitrineSelecaoFiltros";
import {
  itensEstoqueService,
  type ColunaOrdemVitrine,
  type ItemEstoqueVitrine,
} from "../../services/itens-estoque";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import {
  vitrinesService,
  type VitrineComItens,
  type VitrineCorrespondenciaSnapshot,
  type VitrineItemDetalhado,
  type VitrineItemSnapshot,
} from "../../services/vitrines";
import type { EtapaVitrine } from "../../types/entities";
import { cn } from "../../utils/cn";
import { formatarMoeda } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";
import { useVitrinePdfImagens } from "../../hooks/useVitrinePdfImagens";
import { normalizarUrlImagemValor } from "../../utils/imagemModelo";
import { resolverMoedaVendaItem } from "../../utils/moedaItemEstoque";

const CLASSE_BOTAO_ETAPA = "py-1.5 px-3";
const CLASSE_RODAPE_ETAPA = "flex justify-between gap-3";

const ETAPAS: Array<{ id: EtapaVitrine; label: string }> = [
  { id: "selecao", label: "Seleção" },
  { id: "organizacao", label: "Organização" },
  { id: "correspondencias", label: "Correspondências" },
  { id: "destino_anterior", label: "Vitrine Anterior" },
  { id: "revisao", label: "Revisão" },
];

const MAPA_CAIXAS: Array<{ numero: number; left: number; top: number }> = [
  { numero: 12, left: 5, top: 22 },
  { numero: 13, left: 14, top: 11 },
  { numero: 14, left: 23, top: 25 },
  { numero: 15, left: 32, top: 5 },
  { numero: 16, left: 41, top: 22 },
  { numero: 17, left: 50, top: 10 },
  { numero: 18, left: 59, top: 28 },
  { numero: 19, left: 68, top: 12 },
  { numero: 20, left: 77, top: 26 },
  { numero: 21, left: 86, top: 20 },
  { numero: 22, left: 95, top: 6 },
  { numero: 1, left: 5, top: 70 },
  { numero: 2, left: 14, top: 52 },
  { numero: 3, left: 23, top: 68 },
  { numero: 4, left: 32, top: 58 },
  { numero: 5, left: 41, top: 72 },
  { numero: 6, left: 50, top: 59 },
  { numero: 7, left: 59, top: 80 },
  { numero: 8, left: 68, top: 58 },
  { numero: 9, left: 77, top: 71 },
  { numero: 10, left: 86, top: 59 },
  { numero: 11, left: 95, top: 50 },
];

export default function VitrineWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [acaoLoading, setAcaoLoading] = useState(false);
  const vitrine = useAsync(() => (id ? vitrinesService.obterComItens(id) : Promise.resolve(null)), [id]);
  const etapa = vitrine.data?.etapa ?? "selecao";
  const tituloEditavel =
    vitrine.data && vitrine.data.status === "rascunho" ? (
      <VitrineTituloEditavel
        idVitrine={vitrine.data.id}
        titulo={vitrine.data.titulo}
        className="font-display text-xl font-semibold whitespace-nowrap text-brand-700 sm:text-2xl lg:text-3xl"
        onAtualizado={() => vitrine.reload()}
      />
    ) : (
      vitrine.data?.titulo ?? "Vitrine"
    );

  const mudarEtapa = async (novaEtapa: EtapaVitrine) => {
    if (!vitrine.data) return;
    setAcaoLoading(true);
    try {
      await vitrinesService.atualizarEtapa(vitrine.data.id, novaEtapa);
      vitrine.reload();
    } catch (error) {
      alert(mensagemErro(error));
    } finally {
      setAcaoLoading(false);
    }
  };

  const publicar = async () => {
    if (!vitrine.data || !user?.id) return;
    if (!confirm("Publicar esta vitrine e atualizar as localizações do estoque?")) return;
    setAcaoLoading(true);
    try {
      await vitrinesService.atualizarEtapa(vitrine.data.id, "revisao");
      await vitrinesService.publicar(vitrine.data.id, user.id);
      navigate("/vitrines/atual");
    } catch (error) {
      alert(mensagemErro(error));
    } finally {
      setAcaoLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "min-h-0 flex-1",
        etapa === "selecao" || etapa === "correspondencias"
          ? "flex flex-col overflow-hidden"
          : "overflow-y-auto",
      )}
    >
      {etapa === "selecao" ? (
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/vitrines"
              className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-brand-400 hover:text-brand-700"
            >
              Voltar
            </Link>
            {vitrine.data ? (
              <VitrineTituloEditavel
                idVitrine={vitrine.data.id}
                titulo={vitrine.data.titulo}
                className="font-display text-xl font-semibold whitespace-nowrap text-brand-700"
                onAtualizado={() => vitrine.reload()}
              />
            ) : (
              <span className="font-display text-xl font-semibold whitespace-nowrap text-brand-700">Vitrine</span>
            )}
          </div>
          <Stepper etapa={etapa} compact inline />
        </div>
      ) : (
        <PageHeader
          title={tituloEditavel}
          actions={<Stepper etapa={etapa} compact inline />}
          breadcrumbs={[{ label: "Operação" }, { label: "Vitrines", to: "/vitrines" }, { label: "Rascunho" }]}
          backTo="/vitrines"
        />
      )}

      {vitrine.loading ? (
        <SectionCard><p className="text-sm text-ink-soft">Carregando rascunho…</p></SectionCard>
      ) : !vitrine.data ? (
        <SectionCard><p className="text-sm text-ink-soft">Rascunho não encontrado.</p></SectionCard>
      ) : vitrine.data.status !== "rascunho" ? (
        <SectionCard>
          <p className="text-sm text-ink-soft">Esta vitrine já foi publicada ou encerrada.</p>
          <Link to={`/vitrines/${vitrine.data.id}`} className="mt-3 inline-flex text-sm font-medium text-brand-700">
            Abrir detalhes
          </Link>
        </SectionCard>
      ) : (
        <div
          className={cn(
            etapa === "selecao" || etapa === "correspondencias"
              ? "flex min-h-0 flex-1 flex-col gap-2"
              : "space-y-5",
          )}
        >
          {etapa === "selecao" ? (
            <SelecaoStep vitrine={vitrine.data} onAvancar={() => mudarEtapa("organizacao")} />
          ) : null}
          {etapa === "organizacao" ? (
            <OrganizacaoStep
              vitrine={vitrine.data}
              onVoltar={() => mudarEtapa("selecao")}
              onAvancar={() => mudarEtapa("correspondencias")}
            />
          ) : null}
          {etapa === "correspondencias" ? (
            <CorrespondenciasStep
              vitrine={vitrine.data}
              onVoltar={() => mudarEtapa("organizacao")}
              onAvancar={() => mudarEtapa("destino_anterior")}
            />
          ) : null}
          {etapa === "destino_anterior" ? (
            <DestinoAnteriorStep
              vitrine={vitrine.data}
              onReload={vitrine.reload}
              onVoltar={() => mudarEtapa("correspondencias")}
              onAvancar={() => mudarEtapa("revisao")}
            />
          ) : null}
          {etapa === "revisao" ? (
            <RevisaoStep
              vitrine={vitrine.data}
              loading={acaoLoading}
              onVoltar={() => mudarEtapa("destino_anterior")}
              onPublicar={publicar}
            />
          ) : null}
        </div>
      )}
      {vitrine.error ? <p className="mt-3 text-sm text-red-700">{vitrine.error.message}</p> : null}
    </div>
  );
}

function Stepper({ etapa, compact, inline }: { etapa: EtapaVitrine; compact?: boolean; inline?: boolean }) {
  const idxAtual = ETAPAS.findIndex((e) => e.id === etapa);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap gap-1.5",
        inline && "justify-end",
        inline ? "" : "card",
        compact ? "px-1 py-0.5" : "px-3 py-2",
      )}
    >
      {ETAPAS.map((e, idx) => (
        <div
          key={e.id}
          className={cn(
            compact
              ? "rounded-full px-2 py-0.5 text-[10px] font-semibold"
              : "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            idx === idxAtual
              ? "bg-brand-600 text-white"
              : idx < idxAtual
                ? "bg-emerald-50 text-emerald-800"
                : "bg-surface-muted text-ink-muted",
          )}
        >
          {idx + 1}. {e.label}
        </div>
      ))}
    </div>
  );
}

function SelecaoStep({
  vitrine,
  onAvancar,
}: {
  vitrine: VitrineComItens;
  onAvancar: () => void;
}) {
  const filtros = useVitrineSelecaoFiltros();
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);
  const [itensSelecionados, setItensSelecionados] = useState(vitrine.itens);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [removendoTodos, setRemovendoTodos] = useState(false);
  const [validando, setValidando] = useState(false);
  const selectedIds = useMemo(
    () => new Set(itensSelecionados.map((item) => item.id_item_estoque)),
    [itensSelecionados],
  );
  const restantes = TOTAL_CAIXAS_VITRINE - itensSelecionados.length;

  useEffect(() => {
    setItensSelecionados(vitrine.itens);
  }, [vitrine.id, vitrine.itens]);

  const selecionadosDep = useMemo(
    () => (filtros.somenteSelecionados ? itensSelecionados.map((i) => i.id_item_estoque).join("|") : ""),
    [filtros.somenteSelecionados, itensSelecionados],
  );

  const listagem = useAsync(async () => {
    if (filtros.somenteSelecionados) {
      const rowsBase = itensSelecionados
        .map((item) => (item.item ? ({ ...item.item } as ItemEstoqueVitrine) : null))
        .filter((item): item is ItemEstoqueVitrine => Boolean(item));
      const idsModelo = [...new Set(rowsBase.map((row) => row.id_modelo_produto))];
      const porModelo = await itensEstoqueService.contagemModeloDisponivelVitrine(
        idsModelo,
        filtros.idsLocaisContagem,
      );
      const rows = itensEstoqueService.aplicarContagemDisponivelVitrine(rowsBase, porModelo, {
        disponiveisExatos: filtros.paramsListagem.disponiveisExatos,
        ordenacao: filtros.paramsListagem.ordenacao,
      });
      return { data: rows, total: rows.length, page: 1, pageSize: rows.length || 1 };
    }
    return itensEstoqueService.listarParaVitrine({
      page: filtros.page,
      pageSize: 50,
      ...filtros.paramsListagem,
    });
  }, [
    filtros.page,
    filtros.paramsListagem,
    filtros.somenteSelecionados,
    filtros.localEstoqueIds,
    filtros.idsLocaisContagem,
    selecionadosDep,
  ]);

  const toggleItem = async (item: ItemEstoqueVitrine) => {
    if (removendoTodos) return;
    const selecionado = selectedIds.has(item.id);
    const itensAnteriores = itensSelecionados;
    setMutatingId(item.id);

    if (selecionado) {
      setItensSelecionados((atuais) => atuais.filter((i) => i.id_item_estoque !== item.id));
      try {
        await vitrinesService.removerItem(vitrine.id, item.id);
      } catch (error) {
        setItensSelecionados(itensAnteriores);
        alert(mensagemErro(error));
      } finally {
        setMutatingId(null);
      }
      return;
    }

    const tempId = `temp-${item.id}`;
    setItensSelecionados((atuais) => [
      ...atuais,
      {
        id: tempId,
        id_vitrine: vitrine.id,
        id_item_estoque: item.id,
        numero_caixa: null,
        nome_exibicao: null,
        ordem_selecao: atuais.length + 1,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        snapshot: null,
        item,
      },
    ]);

    try {
      const criado = await vitrinesService.adicionarItem(vitrine.id, item.id);
      setItensSelecionados((atuais) =>
        atuais.map((i) =>
          i.id === tempId
            ? {
                ...i,
                ...criado,
                id: criado.id,
                item,
                snapshot: null,
              }
            : i,
        ),
      );
    } catch (error) {
      setItensSelecionados(itensAnteriores);
      alert(mensagemErro(error));
    } finally {
      setMutatingId(null);
    }
  };

  const removerTodosSelecionados = async () => {
    if (itensSelecionados.length === 0) return;
    if (!confirm(`Remover os ${itensSelecionados.length} itens selecionados desta vitrine?`)) return;

    const itensAnteriores = itensSelecionados;
    setRemovendoTodos(true);
    setItensSelecionados([]);
    try {
      await vitrinesService.removerItens(
        vitrine.id,
        itensAnteriores.map((item) => item.id_item_estoque),
      );
    } catch (error) {
      setItensSelecionados(itensAnteriores);
      alert(mensagemErro(error));
    } finally {
      setRemovendoTodos(false);
    }
  };

  const avancar = async () => {
    if (itensSelecionados.length !== TOTAL_CAIXAS_VITRINE) return;
    setValidando(true);
    try {
      const validacoes = await vitrinesService.validarItens(
        itensSelecionados.map((item) => item.id_item_estoque),
      );
      const invalidos = validacoes.filter((v) => !v.valido);
      if (invalidos.length > 0) {
        alert(invalidos.map((v) => v.motivo ?? "Item inválido").join("\n"));
        return;
      }
      onAvancar();
    } catch (error) {
      alert(mensagemErro(error));
    } finally {
      setValidando(false);
    }
  };

  const columns: Column<ItemEstoqueVitrine>[] = [
    {
      key: "foto",
      header: <span className="sr-only">Foto</span>,
      width: "76px",
      render: (item) => <FotoThumbnailHover url={thumbs.data?.[item.id_modelo_produto]} alt={nomeModeloItemEstoque(item)} />,
    },
    {
      key: "produto",
      header: (
        <CabecalhoOrdenavelVitrine
          label="Produto"
          coluna="nome_produto"
          colunaAtiva={filtros.colunaOrdem}
          direcao={filtros.direcao}
          onOrdem={filtros.setOrdem}
        />
      ),
      render: (item) => (
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              to={`/itens-estoque/${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-ink hover:text-brand-700"
              onClick={(e) => e.stopPropagation()}
            >
              {nomeModeloItemEstoque(item)}
            </Link>
            {selectedIds.has(item.id) ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                Selecionado
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {item.modelo?.marca?.nome ?? "Sem marca"} · {item.modelo?.categoria?.nome ?? "Sem categoria"}
          </p>
        </div>
      ),
    },
    {
      key: "sku",
      header: (
        <CabecalhoOrdenavelVitrine
          label="SKU"
          coluna="sku"
          colunaAtiva={filtros.colunaOrdem}
          direcao={filtros.direcao}
          onOrdem={filtros.setOrdem}
        />
      ),
      render: (item) => <span className="font-numeric text-sm text-ink-muted">{item.sku}</span>,
    },
    {
      key: "num",
      header: (
        <CabecalhoOrdenavelVitrine
          label="Numeração"
          coluna="numeracao_br"
          colunaAtiva={filtros.colunaOrdem}
          direcao={filtros.direcao}
          onOrdem={filtros.setOrdem}
        />
      ),
      render: (item) => (
        <span className="rounded-lg bg-surface-muted px-2 py-1 font-numeric text-xs font-semibold text-ink">
          {formatarNumeracoes(item)}
        </span>
      ),
    },
    {
      key: "preco",
      header: "Preço",
      render: (item) => (
        <PrecoVendaItem
          preco_venda={item.preco_venda}
          moeda_venda={item.moeda_venda}
          local={item.local}
        />
      ),
    },
    {
      key: "local",
      header: (
        <CabecalhoOrdenavelVitrine
          label="Local"
          coluna="local_nome"
          colunaAtiva={filtros.colunaOrdem}
          direcao={filtros.direcao}
          onOrdem={filtros.setOrdem}
        />
      ),
      render: (item) => (
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900 ring-1 ring-sky-200">
          {item.local?.nome ?? "—"}
        </span>
      ),
    },
    {
      key: "disp",
      header: (
        <CabecalhoOrdenavelVitrine
          label="Disponíveis"
          coluna="contagem_modelo_disponivel"
          colunaAtiva={filtros.colunaOrdem}
          direcao={filtros.direcao}
          onOrdem={filtros.setOrdem}
        />
      ),
      render: (item) => (
        <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
          {item.contagem_modelo_disponivel ?? "—"} unidades disponíveis
        </span>
      ),
    },
    {
      key: "acao",
      header: <span className="sr-only">Ação</span>,
      render: (item) => {
        const selected = selectedIds.has(item.id);
        return selected ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
            onClick={() => toggleItem(item)}
            disabled={mutatingId === item.id || removendoTodos}
          >
            <IconX width={14} height={14} />
            Remover
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            onClick={() => toggleItem(item)}
            disabled={mutatingId === item.id || removendoTodos}
          >
            <IconPlus width={14} height={14} />
            Adicionar
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionCard
        noPadding
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollableListShell
          toolbar={
            <div className="space-y-2 border-b border-line bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-[13rem] flex-1 max-w-[50%]">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-brand-700">
                        {itensSelecionados.length}/22 selecionados
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          restantes === 0
                            ? "text-emerald-700"
                            : restantes > 0
                              ? "text-ink-muted"
                              : "text-amber-700",
                        )}
                      >
                        {restantes === 0
                          ? "Pronto para continuar"
                          : restantes > 0
                            ? `faltam ${restantes}`
                            : `remova ${Math.abs(restantes)}`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          itensSelecionados.length === TOTAL_CAIXAS_VITRINE
                            ? "bg-emerald-500"
                            : itensSelecionados.length > TOTAL_CAIXAS_VITRINE
                              ? "bg-amber-500"
                              : "bg-brand-600",
                        )}
                        style={{
                          width: `${Math.min(100, (itensSelecionados.length / TOTAL_CAIXAS_VITRINE) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="hidden text-xs text-ink-soft sm:inline">
                    {listagem.data?.total ?? 0} resultado(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={removerTodosSelecionados}
                    disabled={itensSelecionados.length === 0 || removendoTodos}
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {removendoTodos ? "Removendo..." : "Remover todos"}
                  </button>
                  <button
                    type="button"
                    onClick={() => filtros.setSomenteSelecionados(!filtros.somenteSelecionados)}
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                      filtros.somenteSelecionados
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-line bg-surface text-ink-muted hover:border-brand-300 hover:text-brand-700",
                    )}
                  >
                    {filtros.somenteSelecionados ? "Ver todos" : `Selecionados (${itensSelecionados.length})`}
                  </button>
                  <PrimaryButton
                    className="min-h-0 px-3 py-1.5 text-xs"
                    disabled={itensSelecionados.length !== 22 || removendoTodos}
                    loading={validando}
                    onClick={avancar}
                  >
                    Continuar
                  </PrimaryButton>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-muted/35 p-2">
                <div className="grid gap-2 xl:grid-cols-[minmax(10rem,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(5.5rem,0.45fr)_minmax(5.5rem,0.45fr)_auto] xl:items-end">
                  <FiltroCampo label="Pesquisa" className="min-w-0 max-w-[14rem]">
                    <SearchInput
                      value={filtros.search}
                      onChange={(e) => filtros.setSearch(e.target.value)}
                      placeholder="SKU, produto…"
                    />
                  </FiltroCampo>
                  <SearchableSelectDropdown
                    multiple
                    value={filtros.localEstoqueFiltroIds}
                    onChange={filtros.setLocalEstoqueIds}
                    options={filtros.opcoesLocalFiltro}
                    emptyLabel="Todos os locais"
                    label="Local"
                    loading={filtros.locaisEuropa.loading}
                  />
                  <SearchableSelectDropdown
                    multiple
                    value={filtros.marcaIds}
                    onChange={filtros.setMarcaIds}
                    options={filtros.opcoesMarcaFiltro}
                    emptyLabel="Marcas"
                    label="Marca"
                    loading={filtros.marcas.loading}
                  />
                  <SearchableSelectDropdown
                    multiple
                    className="min-w-0"
                    value={filtros.categoriaIds}
                    onChange={filtros.setCategoriaIds}
                    options={filtros.opcoesCategoriaFiltro}
                    emptyLabel="Categorias"
                    label="Categoria"
                    loading={filtros.categorias.loading}
                  />
                  <FiltroCampo label="Disp.">
                    <input
                      className="input-base"
                      type="number"
                      min={0}
                      value={filtros.disponiveisFiltro}
                      onChange={(e) => filtros.setDisponiveisFiltro(e.target.value)}
                      placeholder="Qtd."
                      aria-label="Quantidade exata de unidades disponíveis"
                    />
                  </FiltroCampo>
                  <FiltroCampo label="Nº">
                    <input
                      className="input-base"
                      value={filtros.numeracaoFiltro}
                      onChange={(e) => filtros.setNumeracaoFiltro(e.target.value)}
                      placeholder="Nº"
                      aria-label="Numeração"
                    />
                  </FiltroCampo>
                  <div className="flex items-center justify-end gap-2">
                    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" aria-label="Sistema de numeração">
                      {(["br", "eu", "us"] as const).map((sistema) => (
                        <button
                          key={sistema}
                          type="button"
                          onClick={() => filtros.setDisplaySizeSystem(sistema)}
                          title={`Ver numeração ${sistema.toUpperCase()}`}
                          className={cn(
                            "rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition",
                            filtros.displaySizeSystem === sistema
                              ? "bg-brand-600 text-white"
                              : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                          )}
                        >
                          {sistema}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={filtros.limparFiltros}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted transition hover:border-brand-300 hover:text-brand-700"
                      title="Limpar filtros"
                      aria-label="Limpar filtros"
                    >
                      <IconRefresh width={14} height={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
          body={
            <DataTable
              columns={columns}
              rows={listagem.data?.data ?? []}
              rowKey={(item) => item.id}
              loading={listagem.loading || thumbs.loading}
              emptyTitle="Nenhum item encontrado"
              emptyDescription="Ajuste os filtros ou confira se há itens disponíveis nos locais europeus."
              rowClassName={(item) => (selectedIds.has(item.id) ? "bg-emerald-50/45" : undefined)}
            />
          }
          footer={
            !filtros.somenteSelecionados ? (
              <Pagination
                page={filtros.page}
                pageSize={listagem.data?.pageSize ?? 50}
                total={listagem.data?.total ?? 0}
                onPageChange={filtros.setPage}
              />
            ) : null
          }
        />
      </SectionCard>
    </div>
  );
}

function CabecalhoOrdenavelVitrine({
  label,
  coluna,
  colunaAtiva,
  direcao,
  onOrdem,
}: {
  label: string;
  coluna: ColunaOrdemVitrine;
  colunaAtiva: ColunaOrdemVitrine;
  direcao: "asc" | "desc";
  onOrdem: (coluna: ColunaOrdemVitrine) => void;
}) {
  const ativo = coluna === colunaAtiva;
  return (
    <button
      type="button"
      className={cn(
        "-mx-2 -my-1 inline-flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider transition-colors",
        ativo ? "text-ink" : "text-ink-soft hover:bg-brand-50/60 hover:text-ink",
      )}
      onClick={() => onOrdem(coluna)}
    >
      <span>{label}</span>
      <span className={cn("text-brand-600", !ativo && "opacity-35")} aria-hidden>
        {ativo ? (direcao === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

function FiltroCampo({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
    </div>
  );
}

function OrganizacaoStep({
  vitrine,
  onVoltar,
  onAvancar,
}: {
  vitrine: VitrineComItens;
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [modo, setModo] = useState<"mapa" | "lista">("mapa");
  const [itensOrganizados, setItensOrganizados] = useState(vitrine.itens);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);
  const posicionados = itensOrganizados.filter((item) => item.numero_caixa != null).length;
  const itensPorCaixa = new Map(itensOrganizados.map((item) => [item.numero_caixa, item]));
  const naoPosicionados = itensOrganizados.filter((item) => item.numero_caixa == null);
  const caixasOcupadas = new Set(
    itensOrganizados
      .map((item) => item.numero_caixa)
      .filter((numero): numero is number => numero != null),
  );

  useEffect(() => {
    setItensOrganizados(vitrine.itens);
  }, [vitrine.id, vitrine.itens]);

  const aplicarPosicoes = (
    itens: VitrineItemDetalhado[],
    posicoes: Array<{ id_item_estoque: string; numero_caixa: number | null }>,
  ) => {
    const porItem = new Map(posicoes.map((posicao) => [posicao.id_item_estoque, posicao.numero_caixa]));
    return itens.map((item) =>
      porItem.has(item.id_item_estoque)
        ? { ...item, numero_caixa: porItem.get(item.id_item_estoque) ?? null }
        : item,
    );
  };

  const salvar = async (posicoes: Array<{ id_item_estoque: string; numero_caixa: number | null }>) => {
    const itensAnteriores = itensOrganizados;
    setItensOrganizados((atuais) => aplicarPosicoes(atuais, posicoes));
    setSalvando(true);
    try {
      await vitrinesService.salvarPosicoes(vitrine.id, posicoes);
    } catch (error) {
      setItensOrganizados(itensAnteriores);
      alert(mensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (salvando) return;
    const idItem = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    const ativo = itensOrganizados.find((item) => item.id_item_estoque === idItem);
    if (!ativo || !overId) return;

    if (overId === "pool") {
      salvar([{ id_item_estoque: ativo.id_item_estoque, numero_caixa: null }]);
      return;
    }

    if (!overId.startsWith("box-")) return;
    const caixaDestino = Number(overId.replace("box-", ""));
    const caixaOrigem = ativo.numero_caixa;
    const ocupante = itensOrganizados.find((item) => item.numero_caixa === caixaDestino);
    const posicoes: Array<{ id_item_estoque: string; numero_caixa: number | null }> = [
      { id_item_estoque: ativo.id_item_estoque, numero_caixa: caixaDestino },
    ];
    if (ocupante && ocupante.id_item_estoque !== ativo.id_item_estoque) {
      posicoes.push({ id_item_estoque: ocupante.id_item_estoque, numero_caixa: caixaOrigem ?? null });
    }
    salvar(posicoes);
  };

  const escolherCaixa = async (item: VitrineItemDetalhado, value: string) => {
    if (salvando) return;
    const numero = value ? Number(value) : null;
    const ocupante = numero ? itensOrganizados.find((i) => i.numero_caixa === numero) : null;
    const posicoes: Array<{ id_item_estoque: string; numero_caixa: number | null }> = [
      { id_item_estoque: item.id_item_estoque, numero_caixa: numero },
    ];
    if (ocupante && ocupante.id_item_estoque !== item.id_item_estoque) {
      posicoes.push({ id_item_estoque: ocupante.id_item_estoque, numero_caixa: item.numero_caixa ?? null });
    }
    await salvar(posicoes);
  };

  const limparCaixas = async () => {
    if (salvando || posicionados === 0) return;
    if (
      !confirm(
        "Remover todos os tênis das caixas? Eles voltarão para a lista de não posicionados.",
      )
    ) {
      return;
    }
    const posicoes = itensOrganizados
      .filter((item) => item.numero_caixa != null)
      .map((item) => ({ id_item_estoque: item.id_item_estoque, numero_caixa: null }));
    await salvar(posicoes);
  };

  return (
    <SectionCard
      title={`Organizar caixas · ${posicionados} de 22 tênis posicionados`}
      titleAccessory={
        <SecondaryButton
          className="min-h-0 px-2.5 py-1 text-xs"
          disabled={posicionados === 0 || salvando}
          onClick={limparCaixas}
        >
          Limpar caixas
        </SecondaryButton>
      }
      actions={
        <div className="inline-flex rounded-lg border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setModo("mapa")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition",
              modo === "mapa" ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            Mapa da vitrine
          </button>
          <button
            type="button"
            onClick={() => setModo("lista")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition",
              modo === "lista" ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            Escolher por tênis
          </button>
        </div>
      }
    >
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {modo === "mapa" ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="relative mx-auto h-[32rem] min-w-[70rem] max-w-[78rem] px-2 pt-3">
                {MAPA_CAIXAS.map(({ numero, left, top }) => {
                  const item = itensPorCaixa.get(numero);
                  return (
                    <MapaCaixaDrop
                      key={numero}
                      numero={numero}
                      id={`box-${numero}`}
                      left={left}
                      top={top}
                      item={item}
                      onRetirar={() =>
                        item ? salvar([{ id_item_estoque: item.id_item_estoque, numero_caixa: null }]) : undefined
                      }
                    >
                      {item ? (
                        <DraggableVitrineItem item={item} variant="mapa">
                          <MapaItem item={item} thumbs={thumbs.data} />
                        </DraggableVitrineItem>
                      ) : null}
                    </MapaCaixaDrop>
                  );
                })}
              </div>
            </div>
            <DroppablePool className="rounded-none border-0 border-t border-line bg-surface-muted/25 p-3 shadow-none">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">Tênis ainda não posicionados</h3>
                <span className="text-xs font-medium text-ink-soft">{naoPosicionados.length} para arrastar</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {naoPosicionados.map((item) => (
                  <div key={item.id} className="w-56 shrink-0">
                    <DraggableVitrineItem item={item}>
                      <CaixaResumoCard item={item} thumbs={thumbs.data} compact />
                    </DraggableVitrineItem>
                  </div>
                ))}
                {naoPosicionados.length === 0 ? (
                  <p className="w-full rounded-xl border border-dashed border-line bg-white/70 p-3 text-center text-sm text-ink-soft">
                    Todos os itens estão em caixas. Arraste uma caixa de volta para cá para retirar.
                  </p>
                ) : null}
              </div>
            </DroppablePool>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Escolha a caixa de cada tênis. Itens sem caixa ficam destacados em amarelo.
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itensOrganizados.map((item) => {
                const semCaixa = item.numero_caixa == null;
                return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border p-3 transition",
                    semCaixa ? "border-amber-300 bg-amber-50/70 ring-1 ring-amber-200" : "border-line",
                  )}
                >
                  {semCaixa ? (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                        Sem caixa
                      </span>
                      <span className="text-[11px] font-medium text-amber-800">Selecione uma caixa abaixo</span>
                    </div>
                  ) : null}
                  <CaixaResumoCard item={item} thumbs={thumbs.data} numeroCaixa={item.numero_caixa} compact />
                  <EscolherCaixa item={item} caixasOcupadas={caixasOcupadas} onChange={escolherCaixa} />
                </div>
                );
              })}
            </div>
          </div>
        )}
      </DndContext>
      <div className={cn(CLASSE_RODAPE_ETAPA, "mt-3")}>
        <SecondaryButton className={CLASSE_BOTAO_ETAPA} onClick={onVoltar}>Voltar</SecondaryButton>
        <PrimaryButton className={CLASSE_BOTAO_ETAPA} disabled={posicionados !== 22 || salvando} loading={salvando} onClick={onAvancar}>
          Continuar
        </PrimaryButton>
      </div>
    </SectionCard>
  );
}

function DraggableVitrineItem({
  item,
  children,
  variant = "card",
}: {
  item: VitrineItemDetalhado;
  children: ReactNode;
  variant?: "card" | "mapa";
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id_item_estoque,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        variant === "mapa"
          ? "h-full w-full cursor-grab rounded-xl bg-brand-50 text-brand-900 active:cursor-grabbing"
          : "cursor-grab rounded-xl border border-line bg-surface p-3 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-70",
      )}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

function MapaCaixaDrop({
  id,
  numero,
  left,
  top,
  item,
  onRetirar,
  children,
}: {
  id: string;
  numero: number;
  left: number;
  top: number;
  item?: VitrineItemDetalhado;
  onRetirar: () => void | Promise<void> | undefined;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute h-24 w-24 -translate-x-1/2 rounded-xl border-2 border-ink bg-white shadow-sm transition",
        item && "border-brand-500 bg-brand-50",
        isOver && "scale-105 border-brand-600 ring-4 ring-brand-200",
      )}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div className="absolute -left-3 -top-3 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-brand-700 px-2 text-sm font-bold text-white shadow-md ring-2 ring-white">
        {numero}
      </div>
      {item ? (
        <>
          {children}
          <button
            type="button"
            className="absolute -right-3 -top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-base font-bold leading-none text-white shadow-md ring-2 ring-white transition hover:bg-red-700"
            aria-label={`Retirar tênis da caixa ${numero}`}
            onClick={(event) => {
              event.stopPropagation();
              onRetirar();
            }}
          >
            ×
          </button>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-xl text-xs font-semibold text-ink-soft">
          Soltar
        </div>
      )}
    </div>
  );
}

function MapaItem({ item, thumbs }: { item: VitrineItemDetalhado; thumbs?: Record<string, string> | null }) {
  const nome = item.item?.modelo?.nome_modelo ?? item.item?.nome_produto ?? item.nome_exibicao ?? "Tênis";
  const foto = fotoItemVitrine(item, thumbs);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-white text-center">
      {foto ? (
        <img
          src={foto}
          alt={nome}
          className="h-full w-full object-contain px-1.5 pb-5 pt-1.5"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center px-2 pb-5 pt-2">
          <span className="mt-0.5 block max-w-full truncate text-[9px] leading-tight text-brand-900/80" title={nome}>
            {nome}
          </span>
        </div>
      )}
      <div className="absolute inset-x-1 bottom-1 rounded-md bg-brand-700 px-1.5 py-1 shadow-sm">
        <span className="block truncate text-[9px] font-bold leading-none text-white">{item.item?.sku ?? "SKU"}</span>
      </div>
    </div>
  );
}

function DroppablePool({ children, className }: { children: ReactNode; className?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={cn("rounded-xl border border-line bg-surface-muted/30 p-4", isOver && "ring-2 ring-brand-400", className)}
    >
      {children}
    </div>
  );
}

function EscolherCaixa({
  item,
  caixasOcupadas,
  onChange,
}: {
  item: VitrineItemDetalhado;
  caixasOcupadas: Set<number>;
  onChange: (item: VitrineItemDetalhado, value: string) => void;
}) {
  const caixaAtual = item.numero_caixa;
  const options = useMemo(() => {
    const caixasDisponiveis = Array.from({ length: TOTAL_CAIXAS_VITRINE }, (_, index) => index + 1).filter(
      (numero) => !caixasOcupadas.has(numero) || numero === caixaAtual,
    );
    return [
      { value: "", label: "Sem caixa" },
      ...caixasDisponiveis.map((numero) => ({
        value: String(numero),
        label: `Caixa ${numero}`,
      })),
    ];
  }, [caixaAtual, caixasOcupadas]);

  return (
    <div
      className="mt-3"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <SearchableSelectDropdown
        label="Caixa"
        value={caixaAtual != null ? String(caixaAtual) : ""}
        onChange={(value) => onChange(item, value)}
        options={options}
        emptyLabel="Sem caixa"
        searchPlaceholder="Buscar caixa…"
        triggerClassName="h-9 rounded-lg text-xs"
      />
    </div>
  );
}

function CorrespondenciasStep({
  vitrine,
  onVoltar,
  onAvancar,
}: {
  vitrine: VitrineComItens;
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  const { user } = useAuth();
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvandoPrecoId, setSalvandoPrecoId] = useState<string | null>(null);
  const [precosLocais, setPrecosLocais] = useState<
    Record<string, { preco_venda: number; moeda_venda: string | null }>
  >({});
  const [nomesExibicao, setNomesExibicao] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      vitrine.itens.map((item) => [
        item.id,
        item.nome_exibicao ?? item.item?.modelo?.nome_modelo ?? item.item?.nome_produto ?? "",
      ]),
    ),
  );
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);
  const idsSelecionados = vitrine.itens.map((item) => item.id_item_estoque);
  const correspondencias = useAsync(async () => {
    const pares = await Promise.all(
      vitrine.itens.map(async (item) => {
        if (!item.item?.id_modelo_produto) {
          return [item.id, [] as VitrineCorrespondenciaSnapshot[]] as const;
        }
        const data = await vitrinesService.buscarCorrespondencias(
          item.id_item_estoque,
          item.item.id_modelo_produto,
          idsSelecionados,
        );
        return [item.id, data] as const;
      }),
    );
    return new Map<string, VitrineCorrespondenciaSnapshot[]>(pares);
  }, [vitrine.itens.map((item) => item.id).join(",")]);

  const itensLocais = useMemo(
    () =>
      vitrine.itens.map((item) => {
        const precoLocal = precosLocais[item.id_item_estoque];
        return {
          ...item,
          nome_exibicao: nomesExibicao[item.id]?.trim() || null,
          item: item.item
            ? {
                ...item.item,
                preco_venda: precoLocal?.preco_venda ?? item.item.preco_venda,
                moeda_venda: precoLocal?.moeda_venda ?? item.item.moeda_venda,
              }
            : item.item,
        };
      }),
    [nomesExibicao, precosLocais, vitrine.itens],
  );

  const correspondenciasComPrecos = useMemo(() => {
    if (!correspondencias.data) return correspondencias.data;
    const map = new Map<string, VitrineCorrespondenciaSnapshot[]>();
    for (const [itemId, lista] of correspondencias.data) {
      map.set(
        itemId,
        lista.map((corr) => {
          const idEstoque = corr.id_item_estoque;
          if (!idEstoque) return corr;
          const precoLocal = precosLocais[idEstoque];
          if (!precoLocal) return corr;
          return { ...corr, preco: precoLocal.preco_venda, moeda: precoLocal.moeda_venda };
        }),
      );
    }
    return map;
  }, [correspondencias.data, precosLocais]);

  const salvarPrecoItem = async (idItemEstoque: string, preco: number, moeda: string | null) => {
    if (!user?.id) throw new Error("Usuário não autenticado");
    setSalvandoPrecoId(idItemEstoque);
    try {
      const atualizado = await itensEstoqueService.atualizarPrecoVenda({
        idItem: idItemEstoque,
        precoNovo: preco,
        moedaNova: moeda,
        idUsuario: user.id,
        origem: "vitrine_correspondencias",
      });
      setPrecosLocais((prev) => ({
        ...prev,
        [idItemEstoque]: {
          preco_venda: atualizado.preco_venda,
          moeda_venda: atualizado.moeda_venda,
        },
      }));
    } finally {
      setSalvandoPrecoId(null);
    }
  };

  const vitrinePreviewPdf = useMemo<VitrineComItens>(() => {
    const itens = itensLocais.map((item) => {
      const lista = correspondenciasComPrecos?.get(item.id) ?? item.snapshot?.correspondencias ?? [];
      const snapshot = item.snapshot
        ? {
            ...item.snapshot,
            nome_exibicao: item.nome_exibicao?.trim() || item.snapshot.nome_exibicao,
            foto_url: normalizarUrlImagemValor(fotoItemVitrinePdf(item, thumbs.data)),
            correspondencias: lista,
            item_unico: lista.length === 0,
          }
        : criarSnapshotPreviewPdf(item, thumbs.data, lista);

      return { ...item, snapshot };
    });

    return { ...vitrine, itens };
  }, [correspondenciasComPrecos, itensLocais, thumbs.data, vitrine]);

  const pdfImagens = useVitrinePdfImagens(vitrinePreviewPdf, thumbs.data);
  const pdfPronto =
    !pdfImagens.loading &&
    !correspondencias.loading &&
    !thumbs.loading &&
    (pdfImagens.totalUrls === 0 || pdfImagens.carregadas > 0);

  const salvarNome = async (itemId: string, nome: string) => {
    const normalizado = nome.trim();
    const valorSalvar = normalizado || null;
    const item = vitrine.itens.find((i) => i.id === itemId);
    const atual = item?.nome_exibicao?.trim() || null;
    if (valorSalvar === atual) return;

    setSalvandoId(itemId);
    try {
      await vitrinesService.atualizarItem(itemId, { nome_exibicao: valorSalvar });
    } catch (error) {
      alert(mensagemErro(error));
      if (item) {
        setNomesExibicao((prev) => ({
          ...prev,
          [itemId]:
            item.nome_exibicao ?? item.item?.modelo?.nome_modelo ?? item.item?.nome_produto ?? "",
        }));
      }
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionCard
        title="Correspondências"
        description="Outros itens disponíveis do mesmo modelo, excluindo os 22 expostos."
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        actions={
          pdfPronto ? (
            <PDFDownloadLink
              document={
                <VitrinePdfDocument
                  vitrine={vitrinePreviewPdf}
                  thumbs={thumbs.data}
                  imageDataUrls={pdfImagens.imageDataUrls}
                />
              }
              fileName={`${vitrine.titulo.replace(/[^\w-]+/g, "-").toLowerCase()}-previa.pdf`}
            >
              {({ loading }) => (
                <span className="btn-primary">
                  Baixar prévia PDF
                  {loading ? "…" : ""}
                </span>
              )}
            </PDFDownloadLink>
          ) : (
            <span className="btn-primary pointer-events-none opacity-60">
              Preparando imagens…
            </span>
          )
        }
      >
        <ScrollableListShell
          body={
            <div className="space-y-8 p-5">
              {[...itensLocais]
                .sort((a, b) => (a.numero_caixa ?? 999) - (b.numero_caixa ?? 999))
                .map((item) => {
                  const lista = correspondenciasComPrecos?.get(item.id) ?? [];
                  return (
                    <div key={item.id} className="rounded-xl border border-line p-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
                        <div>
                          <CaixaResumoCard
                            item={item}
                            thumbs={thumbs.data}
                            numeroCaixa={item.numero_caixa}
                            destaquePreco
                            editarPreco={{
                              idItemEstoque: item.id_item_estoque,
                              disabled: salvandoPrecoId === item.id_item_estoque,
                              onSalvo: (preco, moeda) => salvarPrecoItem(item.id_item_estoque, preco, moeda),
                            }}
                          />
                          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                            Nome de exibição no PDF
                          </label>
                          <input
                            className="input-base mt-1"
                            value={nomesExibicao[item.id] ?? ""}
                            disabled={salvandoId === item.id}
                            onChange={(event) =>
                              setNomesExibicao((prev) => ({ ...prev, [item.id]: event.target.value }))
                            }
                            onBlur={(event) => void salvarNome(item.id, event.target.value)}
                          />
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                            Correspondências
                          </p>
                          {correspondencias.loading ? (
                            <p className="text-sm text-ink-soft">Carregando…</p>
                          ) : lista.length === 0 ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                              Único
                            </span>
                          ) : (
                            <div className="space-y-2">
                              {lista.map((corr) => (
                                <CorrespondenciaCard
                                  key={corr.id_item_estoque ?? corr.sku}
                                  correspondencia={corr}
                                  thumbs={thumbs.data}
                                  idModeloProduto={item.item?.id_modelo_produto}
                                  salvandoPreco={salvandoPrecoId === corr.id_item_estoque}
                                  onSalvoPreco={
                                    corr.id_item_estoque
                                      ? (preco, moeda) => salvarPrecoItem(corr.id_item_estoque!, preco, moeda)
                                      : undefined
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          }
          footer={
            <div className={cn(CLASSE_RODAPE_ETAPA, "border-t border-line bg-surface px-4 py-2")}>
              <SecondaryButton className={CLASSE_BOTAO_ETAPA} onClick={onVoltar}>Voltar</SecondaryButton>
              <PrimaryButton className={CLASSE_BOTAO_ETAPA} onClick={onAvancar}>Continuar</PrimaryButton>
            </div>
          }
        />
      </SectionCard>
    </div>
  );
}

function CorrespondenciaCard({
  correspondencia,
  thumbs,
  idModeloProduto,
  onSalvoPreco,
  salvandoPreco,
}: {
  correspondencia: VitrineCorrespondenciaSnapshot;
  thumbs?: Record<string, string> | null;
  idModeloProduto?: string | null;
  onSalvoPreco?: (preco: number, moeda: string | null) => Promise<void>;
  salvandoPreco?: boolean;
}) {
  const foto = idModeloProduto ? thumbs?.[idModeloProduto] ?? null : null;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-muted p-3 text-sm">
      <FotoThumbnailHover url={foto} alt={correspondencia.sku} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-numeric text-xs font-semibold text-ink-muted">SKU {correspondencia.sku}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink">
            {formatarNumeracoes(correspondencia)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-ink-soft">{correspondencia.local_nome ?? "Local não informado"}</p>
      </div>
      {onSalvoPreco && correspondencia.id_item_estoque ? (
        <PrecoVendaEditavel
          idItemEstoque={correspondencia.id_item_estoque}
          preco_venda={correspondencia.preco}
          moeda_venda={correspondencia.moeda}
          tipoRegiaoLocal="europa"
          className="shrink-0"
          destaque
          disabled={salvandoPreco}
          onSalvo={onSalvoPreco}
        />
      ) : (
        <span className="shrink-0 font-numeric text-lg font-bold tabular-nums text-brand-800">
          {correspondencia.preco != null
            ? formatarMoeda(correspondencia.preco, correspondencia.moeda ?? "EUR")
            : "—"}
        </span>
      )}
    </div>
  );
}

function criarSnapshotPreviewPdf(
  item: VitrineItemDetalhado,
  thumbs: Record<string, string> | null | undefined,
  correspondencias: VitrineCorrespondenciaSnapshot[],
): VitrineItemSnapshot {
  const modelo = item.item?.modelo;
  const nomeModelo = modelo?.nome_modelo ?? item.item?.nome_produto ?? null;

  return {
    id_item_estoque: item.id_item_estoque,
    sku: item.item?.sku ?? "—",
    nome_produto: item.item?.nome_produto ?? nomeModelo ?? "Item",
    nome_exibicao: item.nome_exibicao?.trim() || nomeModelo || item.item?.nome_produto || "Item",
    foto_url: normalizarUrlImagemValor(fotoItemVitrinePdf(item, thumbs)),
    id_modelo_produto: item.item?.id_modelo_produto ?? "",
    nome_modelo: modelo?.nome_modelo ?? null,
    marca: modelo?.marca?.nome ?? null,
    categoria: modelo?.categoria?.nome ?? null,
    numeracao_br: item.item?.numeracao_br ?? null,
    numeracao_eu: item.item?.numeracao_eu ?? null,
    numeracao_us: item.item?.numeracao_us ?? null,
    sistema_numeracao: item.item?.sistema_numeracao ?? null,
    preco: item.item?.preco_venda ?? null,
    moeda: resolverMoedaVendaItem(item.item?.moeda_venda, item.item?.local?.tipo_regiao),
    correspondencias,
    item_unico: correspondencias.length === 0,
  };
}

function DestinoAnteriorStep({
  vitrine,
  onReload,
  onVoltar,
  onAvancar,
}: {
  vitrine: VitrineComItens;
  onReload: () => void;
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  const atual = useAsync(() => vitrinesService.obterAtualComItens(), []);
  const locais = useAsync(async () => {
    const todos = await locaisEstoqueService.listarTodos();
    return todos.filter(
      (local) => local.ativo && local.codigo.trim().toLowerCase() !== "vitrine" && local.nome.trim().toLowerCase() !== "vitrine",
    );
  }, []);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [localLote, setLocalLote] = useState("");
  const [salvando, setSalvando] = useState(false);
  const destinoPorItem = new Map(vitrine.destinos.map((destino) => [destino.id_item_estoque, destino.id_local_destino]));
  const idsItensNovaVitrine = new Set(vitrine.itens.map((item) => item.id_item_estoque));
  const itensAnteriores = (atual.data?.itens ?? []).filter(
    (item) => !idsItensNovaVitrine.has(item.id_item_estoque),
  );

  const salvarDestino = async (idItem: string, idLocal: string) => {
    setSalvando(true);
    try {
      await vitrinesService.salvarDestino(vitrine.id, idItem, idLocal);
      onReload();
    } catch (error) {
      alert(mensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  const aplicarLote = async () => {
    if (!localLote || selecionados.length === 0) return;
    setSalvando(true);
    try {
      await vitrinesService.aplicarDestinoEmLote(vitrine.id, selecionados, localLote);
      setSelecionados([]);
      onReload();
    } catch (error) {
      alert(mensagemErro(error));
    } finally {
      setSalvando(false);
    }
  };

  const todosComDestino = itensAnteriores.length === 0 || itensAnteriores.every((item) => destinoPorItem.has(item.id_item_estoque));
  const mensagemSemItensAnteriores =
    atual.data?.itens.length === 0
      ? "Não há vitrine anterior publicada. Esta etapa pode ser ignorada."
      : "Todos os itens da vitrine anterior continuam na nova vitrine. Esta etapa pode ser ignorada.";

  return (
    <SectionCard title="Vitrine Anterior" description="Defina para onde os itens atualmente expostos voltarão.">
      {atual.loading || locais.loading ? (
        <p className="text-sm text-ink-soft">Carregando…</p>
      ) : itensAnteriores.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">{mensagemSemItensAnteriores}</p>
          <div className={CLASSE_RODAPE_ETAPA}>
            <SecondaryButton className={CLASSE_BOTAO_ETAPA} onClick={onVoltar}>Voltar</SecondaryButton>
            <PrimaryButton className={CLASSE_BOTAO_ETAPA} onClick={onAvancar}>Continuar</PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface-muted/40 p-3">
            <SearchableSelectDropdown
              value={localLote}
              onChange={setLocalLote}
              options={[{ value: "", label: "Selecione o destino" }, ...(locais.data ?? []).map((l) => ({ value: l.id, label: l.nome }))]}
              emptyLabel="Destino em lote"
              label="Destino em lote"
            />
            <SecondaryButton disabled={!localLote || selecionados.length === 0 || salvando} onClick={aplicarLote}>
              Aplicar em {selecionados.length} item(ns)
            </SecondaryButton>
          </div>
          <div className="space-y-3">
            {itensAnteriores.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border border-line p-3 lg:grid-cols-[2rem_minmax(0,1fr)_18rem] lg:items-center">
                <input
                  type="checkbox"
                  checked={selecionados.includes(item.id_item_estoque)}
                  onChange={(event) =>
                    setSelecionados((prev) =>
                      event.target.checked
                        ? [...prev, item.id_item_estoque]
                        : prev.filter((id) => id !== item.id_item_estoque),
                    )
                  }
                  className="h-4 w-4"
                />
                <CaixaResumoCard item={item} numeroCaixa={item.numero_caixa} compact />
                <select
                  className="input-base"
                  value={destinoPorItem.get(item.id_item_estoque) ?? ""}
                  onChange={(event) => salvarDestino(item.id_item_estoque, event.target.value)}
                >
                  <option value="">Selecione o destino</option>
                  {(locais.data ?? []).map((local) => (
                    <option key={local.id} value={local.id}>
                      {local.nome}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className={CLASSE_RODAPE_ETAPA}>
            <SecondaryButton className={CLASSE_BOTAO_ETAPA} onClick={onVoltar}>Voltar</SecondaryButton>
            <PrimaryButton className={CLASSE_BOTAO_ETAPA} disabled={!todosComDestino || salvando} loading={salvando} onClick={onAvancar}>
              Continuar
            </PrimaryButton>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function RevisaoStep({
  vitrine,
  loading,
  onVoltar,
  onPublicar,
}: {
  vitrine: VitrineComItens;
  loading: boolean;
  onVoltar: () => void;
  onPublicar: () => void;
}) {
  const atual = useAsync(() => vitrinesService.obterAtualComItens(), []);
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);

  const itensParaVitrine = useMemo(
    () =>
      [...vitrine.itens].sort((a, b) => (a.numero_caixa ?? 999) - (b.numero_caixa ?? 999)),
    [vitrine.itens],
  );

  const idsItensNovaVitrine = useMemo(
    () => new Set(vitrine.itens.map((item) => item.id_item_estoque)),
    [vitrine.itens],
  );

  const itensParaEstoque = useMemo(() => {
    return (atual.data?.itens ?? [])
      .filter((item) => !idsItensNovaVitrine.has(item.id_item_estoque))
      .map((item) => ({
        item,
        destino: vitrine.destinos.find((d) => d.id_item_estoque === item.id_item_estoque) ?? null,
      }))
      .sort((a, b) => {
        const destinoA = a.destino?.local_destino?.nome ?? "zzz";
        const destinoB = b.destino?.local_destino?.nome ?? "zzz";
        const cmpDestino = destinoA.localeCompare(destinoB, "pt-BR");
        if (cmpDestino !== 0) return cmpDestino;
        return (a.item.item?.sku ?? "").localeCompare(b.item.item?.sku ?? "", "pt-BR", { numeric: true });
      });
  }, [atual.data?.itens, idsItensNovaVitrine, vitrine.destinos]);

  const gruposEstoque = useMemo(() => {
    const map = new Map<
      string,
      { idLocal: string | null; nomeLocal: string; itens: typeof itensParaEstoque }
    >();

    for (const entrada of itensParaEstoque) {
      const idLocal = entrada.destino?.id_local_destino ?? null;
      const nomeLocal = entrada.destino?.local_destino?.nome ?? "Sem destino definido";
      const chave = idLocal ?? "__sem_destino__";
      const grupo = map.get(chave);
      if (grupo) {
        grupo.itens.push(entrada);
      } else {
        map.set(chave, { idLocal, nomeLocal, itens: [entrada] });
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.idLocal === null) return 1;
      if (b.idLocal === null) return -1;
      return a.nomeLocal.localeCompare(b.nomeLocal, "pt-BR");
    });
  }, [itensParaEstoque]);

  const posicionados = vitrine.itens.filter((item) => item.numero_caixa != null).length;
  const podePublicar = vitrine.itens.length === TOTAL_CAIXAS_VITRINE && posicionados === TOTAL_CAIXAS_VITRINE;
  const semDestino = itensParaEstoque.filter((entrada) => !entrada.destino?.id_local_destino).length;
  const temVitrineAnterior = (atual.data?.itens.length ?? 0) > 0;

  const mensagemSemRetornoEstoque = !temVitrineAnterior
    ? "Não há vitrine publicada no momento. Nenhum item será retirado da exposição."
    : "Todos os itens da vitrine atual continuam na nova seleção. Nada voltará para o estoque.";

  return (
    <SectionCard
      title="Revisão final"
      description="Confira o que entra na vitrine e o que retorna aos locais de estoque antes de publicar."
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
          <p className="font-semibold text-ink">{vitrine.titulo}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span>
              <span className="font-semibold text-ink">{itensParaVitrine.length}</span> indo para vitrine
            </span>
            <span>·</span>
            <span>
              <span className="font-semibold text-ink">{itensParaEstoque.length}</span> voltando para estoque
            </span>
            <span>·</span>
            <span>
              <span className="font-semibold text-ink">{posicionados}</span> de {TOTAL_CAIXAS_VITRINE} posicionados
            </span>
          </div>
          {!podePublicar ? (
            <p className="mt-3 text-sm text-amber-800">
              A vitrine precisa ter exatamente {TOTAL_CAIXAS_VITRINE} itens, todos posicionados nas caixas, para publicar.
            </p>
          ) : null}
          {semDestino > 0 ? (
            <p className="mt-3 text-sm text-amber-800">
              {semDestino} {semDestino === 1 ? "item ainda precisa" : "itens ainda precisam"} de destino na etapa anterior.
            </p>
          ) : null}
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Indo para a vitrine</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                Estes itens passarão para o local Vitrine ao publicar.
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
              {itensParaVitrine.length} {itensParaVitrine.length === 1 ? "item" : "itens"}
            </span>
          </div>
          {itensParaVitrine.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
              Nenhum item selecionado para a nova vitrine.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itensParaVitrine.map((item) => (
                <div key={item.id} className="rounded-xl border border-brand-200/60 bg-brand-50/20 p-3">
                  <CaixaResumoCard item={item} thumbs={thumbs.data} numeroCaixa={item.numero_caixa} compact />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Voltando para o estoque</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                Itens que saem da vitrine atual e retornam aos locais definidos na etapa anterior.
              </p>
            </div>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line">
              {itensParaEstoque.length} {itensParaEstoque.length === 1 ? "item" : "itens"}
            </span>
          </div>

          {atual.loading ? (
            <p className="text-sm text-ink-soft">Carregando itens da vitrine atual…</p>
          ) : itensParaEstoque.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
              {mensagemSemRetornoEstoque}
            </p>
          ) : (
            <div className="space-y-4">
              {gruposEstoque.map((grupo) => (
                <div
                  key={grupo.idLocal ?? "__sem_destino__"}
                  className={cn(
                    "overflow-hidden rounded-xl border",
                    grupo.idLocal ? "border-line" : "border-amber-300 bg-amber-50/40",
                  )}
                >
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3",
                      grupo.idLocal ? "border-line bg-surface-muted/50" : "border-amber-200 bg-amber-50/80",
                    )}
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Destino</p>
                      <p className="mt-0.5 text-sm font-semibold text-ink">{grupo.nomeLocal}</p>
                    </div>
                    <span className="text-xs font-medium text-ink-soft">
                      {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  <div className="divide-y divide-line/80">
                    {grupo.itens.map(({ item }) => (
                      <div key={item.id} className="p-3">
                        <CaixaResumoCard
                          item={item}
                          thumbs={thumbs.data}
                          numeroCaixa={item.numero_caixa}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className={CLASSE_RODAPE_ETAPA}>
          <SecondaryButton className={CLASSE_BOTAO_ETAPA} onClick={onVoltar}>
            Voltar
          </SecondaryButton>
          <PrimaryButton
            className={CLASSE_BOTAO_ETAPA}
            icon={<IconCheck width={16} height={16} />}
            disabled={!podePublicar || semDestino > 0}
            loading={loading}
            onClick={onPublicar}
          >
            Publicar vitrine
          </PrimaryButton>
        </div>
      </div>
    </SectionCard>
  );
}
