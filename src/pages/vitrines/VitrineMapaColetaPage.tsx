import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { FotoThumbnailHover } from "../../components/FotoThumbnailHover";
import { PageHeader } from "../../components/PageHeader";
import { SectionCard } from "../../components/SectionCard";
import {
  AVISO_MAPA_RECONSTRUIDO,
  ROTULO_SITUACAO_GABARITO,
  SEM_LOCAL,
  TEXTO_BLOCO_MAPA_COLETA,
  TOM_SITUACAO_GABARITO,
  etiquetaDestino,
  organizarMapaColeta,
  resumoGrupoLocal,
  tituloItemMapaColeta,
  type BlocoMapaColeta,
  type EtiquetaMapaColeta,
} from "../../components/vitrines/mapaColeta";
import { formatarNumeracoes } from "../../components/vitrines/VitrineShared";
import { useAsync } from "../../hooks/useAsync";
import { vitrinesService, type MapaColetaItem } from "../../services/vitrines";
import { cn } from "../../utils/cn";
import { formatarData } from "../../utils/format";
import { normalizarUrlImagemValor } from "../../utils/imagemModelo";

function useMarcacoes(idVitrine: string | undefined) {
  const chaveStorage = idVitrine ? `vitrine-mapa-coleta:${idVitrine}` : null;
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!chaveStorage) return;
    try {
      const salvo = sessionStorage.getItem(chaveStorage);
      setMarcados(new Set(salvo ? (JSON.parse(salvo) as string[]) : []));
    } catch {
      setMarcados(new Set());
    }
  }, [chaveStorage]);

  const alternar = (chave: string) => {
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      if (chaveStorage) sessionStorage.setItem(chaveStorage, JSON.stringify([...proximo]));
      return proximo;
    });
  };

  return { marcados, alternar };
}

export default function VitrineMapaColetaPage() {
  const { id } = useParams<{ id: string }>();
  const dados = useAsync(() => (id ? vitrinesService.obterMapaColeta(id) : Promise.resolve(null)), [id]);
  const { marcados, alternar } = useMarcacoes(id);

  const vitrine = dados.data?.vitrine ?? null;
  const mapa = dados.data?.mapa ?? null;
  const gabarito = useMemo(() => dados.data?.gabarito ?? [], [dados.data?.gabarito]);
  const organizado = useMemo(() => (mapa ? organizarMapaColeta(mapa, gabarito) : null), [mapa, gabarito]);
  const passo = (bloco: BlocoMapaColeta) => (organizado?.blocos.indexOf(bloco) ?? -1) + 1;
  const linha = { marcados, onAlternar: alternar };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Mapa de coleta"
        breadcrumbs={[
          { label: "Operação" },
          { label: "Vitrines", to: "/vitrines" },
          ...(vitrine ? [{ label: vitrine.titulo, to: `/vitrines/${vitrine.id}` }] : []),
          { label: "Mapa" },
        ]}
        backTo={id ? `/vitrines/${id}` : "/vitrines"}
        actions={
          mapa && id ? (
            <Link
              to={`/vitrines/${id}/mapa/pdf`}
              className="inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-brand-400 hover:text-brand-700"
            >
              PDF
            </Link>
          ) : null
        }
      />

      {dados.loading ? (
        <SectionCard>
          <p className="text-sm text-ink-soft">Carregando…</p>
        </SectionCard>
      ) : dados.error ? (
        <SectionCard>
          <p className="text-sm text-red-700">{dados.error.message}</p>
        </SectionCard>
      ) : !vitrine ? (
        <SectionCard>
          <p className="text-sm text-ink-soft">Vitrine não encontrada.</p>
        </SectionCard>
      ) : !mapa || !organizado ? (
        <SectionCard>
          <p className="text-sm text-ink-soft">
            {vitrine.status === "rascunho"
              ? "O mapa é gerado quando a vitrine é publicada."
              : "Esta vitrine foi publicada sem registro do mapa de coleta."}
          </p>
        </SectionCard>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="font-display text-lg font-semibold text-ink">{vitrine.titulo}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
              {vitrine.publicado_em ? <span>Publicada em {formatarData(vitrine.publicado_em)}</span> : null}
              <span>
                <span className="font-semibold text-ink">{mapa.saidas.length}</span> saindo
              </span>
              <span>
                <span className="font-semibold text-ink">{mapa.entradas.length}</span> entrando
              </span>
              {mapa.trocas_caixa.length > 0 ? (
                <span>
                  <span className="font-semibold text-ink">{mapa.trocas_caixa.length}</span> mudando de caixa
                </span>
              ) : null}
            </div>
            {mapa.reconstruido ? <p className="mt-2 text-xs text-amber-800">{AVISO_MAPA_RECONSTRUIDO}</p> : null}
          </div>

          {organizado.semMudancas ? (
            <SectionCard>
              <p className="text-sm text-ink-soft">Nenhum par entra, sai ou muda de caixa nesta vitrine.</p>
            </SectionCard>
          ) : null}

          {organizado.blocos.includes("tirar") ? (
            <Bloco passo={passo("tirar")} bloco="tirar">
              <div className="mb-3 rounded-lg border-l-4 border-brand-700 bg-brand-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  Saem da vitrine anterior para montar a vitrine atual
                </p>
                <p className="mt-0.5 text-sm font-semibold text-brand-800">
                  {dados.data?.tituloVitrineAnterior ?? "Vitrine anterior"} → {vitrine.titulo}
                </p>
              </div>
              <ListaItens>
                {mapa.saidas.map((item) => (
                  <LinhaItem
                    key={item.id_item_estoque}
                    item={item}
                    chave={`tirar:${item.id_item_estoque}`}
                    caixa={item.caixa_origem}
                    rotuloCaixa="Sai da caixa"
                    etiqueta={etiquetaDestino(item)}
                    {...linha}
                  />
                ))}
              </ListaItens>
            </Bloco>
          ) : null}

          {organizado.blocos.includes("roteiro") ? (
            <Bloco passo={passo("roteiro")} bloco="roteiro">
              <div className="grid gap-4 lg:grid-cols-2">
                {organizado.grupos.map((grupo) => (
                  <div
                    key={grupo.chave}
                    className={cn(
                      "overflow-hidden rounded-xl border",
                      grupo.chave === SEM_LOCAL ? "border-amber-300" : "border-line",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between gap-2 border-b px-4 py-3",
                        grupo.chave === SEM_LOCAL
                          ? "border-amber-200 bg-amber-50/80"
                          : "border-line bg-surface-muted/50",
                      )}
                    >
                      <p className="text-sm font-semibold text-ink">{grupo.nome}</p>
                      <span className="text-xs text-ink-soft">{resumoGrupoLocal(grupo)}</span>
                    </div>
                    <SubLista titulo="Pegar aqui">
                      {grupo.itens.map((item) => (
                        <LinhaItem
                          key={item.id_item_estoque}
                          item={item}
                          chave={`pegar:${item.id_item_estoque}`}
                          caixa={item.caixa_destino}
                          rotuloCaixa="Vai para a caixa"
                          {...linha}
                        />
                      ))}
                    </SubLista>
                  </div>
                ))}
              </div>
            </Bloco>
          ) : null}

          {organizado.blocos.includes("trocar") ? (
            <Bloco passo={passo("trocar")} bloco="trocar">
              <ListaItens>
                {mapa.trocas_caixa.map((item) => (
                  <LinhaItem
                    key={item.id_item_estoque}
                    item={item}
                    chave={`trocar:${item.id_item_estoque}`}
                    caixa={item.caixa_destino}
                    detalhe={`Da caixa ${item.caixa_origem ?? "—"} para a caixa ${item.caixa_destino ?? "—"}`}
                    {...linha}
                  />
                ))}
              </ListaItens>
            </Bloco>
          ) : null}

          {organizado.blocos.includes("gabarito") ? (
            <Bloco passo={passo("gabarito")} bloco="gabarito">
              <ListaItens>
                {gabarito.map((item) => (
                  <LinhaItem
                    key={item.id_item_estoque}
                    item={item}
                    chave={`gabarito:${item.id_item_estoque}`}
                    caixa={item.caixa_destino}
                    etiqueta={{
                      texto: ROTULO_SITUACAO_GABARITO[item.situacao],
                      tom: TOM_SITUACAO_GABARITO[item.situacao],
                    }}
                    {...linha}
                  />
                ))}
              </ListaItens>
            </Bloco>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Bloco({ passo, bloco, children }: { passo: number; bloco: BlocoMapaColeta; children: ReactNode }) {
  const texto = TEXTO_BLOCO_MAPA_COLETA[bloco];
  return (
    <SectionCard title={`${passo}. ${texto.titulo}`} description={texto.descricao}>
      {children}
    </SectionCard>
  );
}

function ListaItens({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line/80 overflow-hidden rounded-xl border border-line">{children}</div>;
}

function SubLista({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <p className="bg-surface px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">{titulo}</p>
      <div className="divide-y divide-line/80">{children}</div>
    </div>
  );
}

function LinhaItem({
  item,
  chave,
  marcados,
  onAlternar,
  caixa,
  rotuloCaixa = "Caixa",
  detalhe,
  etiqueta,
}: {
  item: MapaColetaItem;
  chave: string;
  marcados: Set<string>;
  onAlternar: (chave: string) => void;
  caixa: number | null;
  rotuloCaixa?: string;
  detalhe?: string;
  etiqueta?: EtiquetaMapaColeta;
}) {
  const marcado = marcados.has(chave);
  const titulo = tituloItemMapaColeta(item);

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-surface-muted/40",
        marcado && "bg-emerald-50/60",
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0"
        checked={marcado}
        onChange={() => onAlternar(chave)}
      />
      <FotoThumbnailHover url={normalizarUrlImagemValor(item.foto_url)} alt={titulo} size="sm" />
      <div className={cn("min-w-0 flex-1", marcado && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-numeric text-xs font-semibold text-ink-muted">SKU {item.sku ?? "—"}</span>
          {item.marca ? <span className="text-xs text-ink-soft">{item.marca}</span> : null}
        </div>
        <p className={cn("truncate text-sm font-semibold text-ink", marcado && "line-through")}>{titulo}</p>
        <p className="text-xs text-ink-muted">
          {formatarNumeracoes(item)}
          {detalhe ? <span className="text-ink-soft"> · {detalhe}</span> : null}
        </p>
      </div>
      {etiqueta ? (
        <div className="shrink-0 text-right">
          {etiqueta.rotulo ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">{etiqueta.rotulo}</p>
          ) : null}
          <p
            className={cn(
              "mt-0.5 rounded-md px-2 py-1 text-sm font-semibold",
              etiqueta.tom === "destaque" && "bg-brand-700 text-white",
              etiqueta.tom === "aviso" && "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
              etiqueta.tom === "neutro" && "bg-surface-muted text-ink-soft ring-1 ring-line",
            )}
          >
            {etiqueta.texto}
          </p>
        </div>
      ) : null}
      {caixa != null ? (
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">{rotuloCaixa}</p>
          <p className="font-numeric text-xl font-bold tabular-nums text-brand-700">{caixa}</p>
        </div>
      ) : null}
    </label>
  );
}
