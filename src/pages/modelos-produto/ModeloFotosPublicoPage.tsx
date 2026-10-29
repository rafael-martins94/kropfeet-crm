import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BrandLogo } from "../../components/BrandLogo";
import { IconChevronLeft, IconChevronRight, IconTrash, IconX } from "../../components/Icons";
import { InlineLoader } from "../../components/LoadingState";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useAsync } from "../../hooks/useAsync";
import { imagensModeloProdutoService } from "../../services/imagens-modelo-produto";
import { modelosProdutoService, type FotoPublicaModelo } from "../../services/modelos-produto";
import { cn } from "../../utils/cn";
import { mensagemErro } from "../../utils/errors";
import { normalizarUrlImagemValor } from "../../utils/imagemModelo";

type FotoVisivel = {
  chave: string;
  id: string | null;
  url: string;
  caminho: string | null;
};

function fotosVisiveis(fotos: FotoPublicaModelo[]): FotoVisivel[] {
  return fotos.flatMap((foto, indice) => {
    const url = normalizarUrlImagemValor(foto.arquivo);
    if (!url) return [];
    return [{ chave: foto.id ?? `${url}-${indice}`, id: foto.id, url, caminho: foto.caminho }];
  });
}

export default function ModeloFotosPublicoPage() {
  const { token = "" } = useParams();
  const auth = useAuth();
  const toast = useToast();
  const admin = !auth.loading && auth.perfil?.papel === "admin" && auth.perfil.ativo;
  const pagina = useAsync(
    () => (auth.loading ? Promise.resolve(null) : modelosProdutoService.abrirFotosPublicas(token)),
    [token, auth.loading, auth.perfil?.id],
  );
  const [lista, setLista] = useState<FotoVisivel[]>([]);
  const [aberta, setAberta] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ordenando, setOrdenando] = useState(false);
  const arrastou = useRef(false);

  useEffect(() => {
    const anterior = document.title;
    document.title = "Fotos - Kropfeet";
    return () => {
      document.title = anterior;
    };
  }, []);

  useEffect(() => {
    setLista(fotosVisiveis(pagina.data?.fotos ?? []));
    setAberta(null);
  }, [pagina.data]);

  const podeGerir = admin && Boolean(pagina.data?.idModelo) && lista.length > 0 && lista.every((foto) => foto.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (aberta == null) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberta(null);
      if (evento.key === "ArrowRight") setAberta((atual) => (atual == null ? atual : Math.min(lista.length - 1, atual + 1)));
      if (evento.key === "ArrowLeft") setAberta((atual) => (atual == null ? atual : Math.max(0, atual - 1)));
    };
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberta, lista.length]);

  const gravarOrdem = async (proxima: FotoVisivel[]) => {
    const idModelo = pagina.data?.idModelo;
    if (!idModelo) return;
    const ordens = proxima.flatMap((foto, ordem) => (foto.id ? [{ id: foto.id, ordem }] : []));
    await imagensModeloProdutoService.reordenar(ordens);
    const primeira = proxima[0];
    if (primeira?.id) await imagensModeloProdutoService.definirPrincipal(idModelo, primeira.id);
  };

  const aoSoltar = (evento: DragEndEvent) => {
    arrastou.current = true;
    window.setTimeout(() => {
      arrastou.current = false;
    }, 50);
    if (ocupado) return;
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const origem = lista.findIndex((foto) => foto.chave === String(active.id));
    const destino = lista.findIndex((foto) => foto.chave === String(over.id));
    if (origem < 0 || destino < 0) return;
    const proxima = arrayMove(lista, origem, destino);
    const anterior = lista;
    setLista(proxima);
    setOcupado(true);
    void gravarOrdem(proxima)
      .catch((erro) => {
        setLista(anterior);
        toast.erro(mensagemErro(erro));
      })
      .finally(() => setOcupado(false));
  };

  const excluir = async (indice: number) => {
    const foto = lista[indice];
    const idModelo = pagina.data?.idModelo;
    if (!foto?.id || !idModelo || ocupado) return;
    if (!window.confirm("Remover esta foto do modelo?")) return;
    const anterior = lista;
    const proxima = lista.filter((_, posicao) => posicao !== indice);
    setLista(proxima);
    if (aberta === indice) setAberta(null);
    else if (aberta != null && aberta > indice) setAberta(aberta - 1);
    setOcupado(true);
    try {
      await imagensModeloProdutoService.remover({ id: foto.id, caminho_arquivo: foto.caminho });
      if (proxima[0]?.id) await imagensModeloProdutoService.definirPrincipal(idModelo, proxima[0].id);
      if (proxima.length > 1) {
        await imagensModeloProdutoService.reordenar(
          proxima.flatMap((item, ordem) => (item.id ? [{ id: item.id, ordem }] : [])),
        );
      }
    } catch (erro) {
      setLista(anterior);
      toast.erro(mensagemErro(erro));
    } finally {
      setOcupado(false);
    }
  };

  const abrir = (indice: number) => {
    if (arrastou.current) return;
    setAberta(indice);
  };

  const carregando = auth.loading || pagina.loading;

  return (
    <main className="flex min-h-screen flex-col bg-surface-muted text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto grid h-16 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <span />
          <BrandLogo size="md" />
          <span className="justify-self-end text-xs font-semibold uppercase tracking-wide text-ink-soft">Fotos</span>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        {carregando ? (
          <div className="flex flex-1 items-center justify-center">
            <InlineLoader label="Abrindo as fotos…" />
          </div>
        ) : null}
        {!carregando && pagina.error ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{pagina.error.message}</p>
        ) : null}
        {!carregando && pagina.data && !pagina.data.encontrado ? (
          <p className="rounded-xl bg-surface p-6 text-sm text-ink-muted">Este link não existe.</p>
        ) : null}
        {!carregando && pagina.data?.encontrado ? (
          lista.length > 0 ? (
            <>
              {podeGerir ? (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-soft">
                    {ordenando ? "Arraste as fotos. A primeira é a principal." : "A primeira foto é a principal."}
                  </p>
                  <button
                    type="button"
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
                      ordenando ? "bg-brand-700 text-white" : "bg-surface text-ink ring-1 ring-line",
                    )}
                    onClick={() => setOrdenando((atual) => !atual)}
                  >
                    {ordenando ? "Concluir" : "Ordenar"}
                  </button>
                </div>
              ) : null}
              {podeGerir ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
                  <SortableContext items={lista.map((foto) => foto.chave)} strategy={rectSortingStrategy}>
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {lista.map((foto, indice) => (
                        <FotoArrastavel
                          key={foto.chave}
                          foto={foto}
                          indice={indice}
                          ocupado={ocupado}
                          ordenando={ordenando}
                          onAbrir={() => abrir(indice)}
                          onExcluir={() => void excluir(indice)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {lista.map((foto, indice) => (
                    <li key={foto.chave} className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
                      <button type="button" className="block w-full cursor-zoom-in" aria-label={`Abrir foto ${indice + 1}`} onClick={() => abrir(indice)}>
                        <img src={foto.url} alt="" className="aspect-square w-full bg-surface-subtle object-contain" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {aberta != null && lista[aberta] ? (
                <VisualizadorFotos
                  fotos={lista.map((foto) => foto.url)}
                  indice={aberta}
                  onIndice={setAberta}
                  onFechar={() => setAberta(null)}
                  onExcluir={podeGerir ? () => void excluir(aberta) : undefined}
                />
              ) : null}
            </>
          ) : (
            <p className="rounded-xl bg-surface p-6 text-sm text-ink-muted">Ainda não há fotos neste link.</p>
          )
        ) : null}
      </div>
    </main>
  );
}

function FotoArrastavel({
  foto,
  indice,
  ocupado,
  ordenando,
  onAbrir,
  onExcluir,
}: {
  foto: FotoVisivel;
  indice: number;
  ocupado: boolean;
  ordenando: boolean;
  onAbrir: () => void;
  onExcluir: () => void;
}) {
  const arrastar = ordenando && !ocupado;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: foto.chave,
    disabled: !arrastar,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line",
        arrastar && "cursor-grab touch-none active:cursor-grabbing",
      )}
      {...(arrastar ? attributes : {})}
      {...(arrastar ? listeners : {})}
    >
      <button type="button" className="block w-full" aria-label={`Abrir foto ${indice + 1}`} onClick={onAbrir}>
        <img src={foto.url} alt="" draggable={false} className="pointer-events-none aspect-square w-full bg-surface-subtle object-contain" />
      </button>
      <button
        type="button"
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-red-700 shadow-md hover:bg-white"
        aria-label="Excluir foto"
        disabled={ocupado}
        onPointerDown={(evento) => evento.stopPropagation()}
        onClick={(evento) => {
          evento.stopPropagation();
          onExcluir();
        }}
      >
        <IconTrash width={16} height={16} />
      </button>
    </li>
  );
}

function VisualizadorFotos({
  fotos,
  indice,
  onIndice,
  onFechar,
  onExcluir,
}: {
  fotos: string[];
  indice: number;
  onIndice: (indice: number) => void;
  onFechar: () => void;
  onExcluir?: () => void;
}) {
  const toque = useRef<number | null>(null);
  const arrastou = useRef(false);
  const temAnterior = indice > 0;
  const temProxima = indice < fotos.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={() => {
        if (arrastou.current) {
          arrastou.current = false;
          return;
        }
        onFechar();
      }}
      onPointerDown={(evento) => {
        toque.current = evento.clientX;
      }}
      onPointerUp={(evento) => {
        if (toque.current == null) return;
        const deslocamento = evento.clientX - toque.current;
        toque.current = null;
        if (deslocamento > 50 && temAnterior) {
          arrastou.current = true;
          onIndice(indice - 1);
        }
        if (deslocamento < -50 && temProxima) {
          arrastou.current = true;
          onIndice(indice + 1);
        }
      }}
    >
      <button
        type="button"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        aria-label="Fechar"
        onPointerDown={(evento) => evento.stopPropagation()}
        onClick={onFechar}
      >
        <IconX width={18} height={18} />
      </button>
      {onExcluir ? (
        <button
          type="button"
          className="absolute right-16 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-red-700 hover:bg-white"
          aria-label="Excluir foto"
          onPointerDown={(evento) => evento.stopPropagation()}
          onClick={(evento) => {
            evento.stopPropagation();
            onExcluir();
          }}
        >
          <IconTrash width={16} height={16} />
        </button>
      ) : null}
      {temAnterior ? (
        <button
          type="button"
          className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md hover:bg-white"
          aria-label="Foto anterior"
          onPointerDown={(evento) => evento.stopPropagation()}
          onClick={(evento) => {
            evento.stopPropagation();
            onIndice(indice - 1);
          }}
        >
          <IconChevronLeft width={20} height={20} />
        </button>
      ) : null}
      <img
        src={fotos[indice]}
        alt=""
        className="max-h-[88vh] max-w-[92vw] object-contain"
        onClick={(evento) => evento.stopPropagation()}
      />
      {temProxima ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md hover:bg-white"
          aria-label="Próxima foto"
          onPointerDown={(evento) => evento.stopPropagation()}
          onClick={(evento) => {
            evento.stopPropagation();
            onIndice(indice + 1);
          }}
        >
          <IconChevronRight width={20} height={20} />
        </button>
      ) : null}
      {fotos.length > 1 ? (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 font-numeric text-sm font-semibold text-white">
          {indice + 1}/{fotos.length}
        </span>
      ) : null}
    </div>
  );
}
