import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";
import { IconChevronLeft, IconChevronRight, IconX } from "../../components/Icons";
import { InlineLoader } from "../../components/LoadingState";
import { useAsync } from "../../hooks/useAsync";
import { modelosProdutoService } from "../../services/modelos-produto";
import { normalizarUrlImagemValor } from "../../utils/imagemModelo";

export default function ModeloFotosPublicoPage() {
  const { token = "" } = useParams();
  const pagina = useAsync(() => modelosProdutoService.abrirFotosPublicas(token), [token]);

  useEffect(() => {
    const anterior = document.title;
    document.title = "Fotos - Kropfeet";
    return () => {
      document.title = anterior;
    };
  }, []);
  const fotos = (pagina.data?.fotos ?? [])
    .map((foto) => normalizarUrlImagemValor(foto))
    .filter((url): url is string => Boolean(url));
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    if (aberta == null) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberta(null);
      if (evento.key === "ArrowRight") setAberta((atual) => (atual == null ? atual : Math.min(fotos.length - 1, atual + 1)));
      if (evento.key === "ArrowLeft") setAberta((atual) => (atual == null ? atual : Math.max(0, atual - 1)));
    };
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberta, fotos.length]);

  return (
    <main className="min-h-screen bg-surface-muted text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <BrandLogo size="md" />
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Fotos</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">
        {pagina.loading ? <InlineLoader label="Abrindo as fotos…" /> : null}
        {!pagina.loading && pagina.error ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{pagina.error.message}</p>
        ) : null}
        {!pagina.loading && pagina.data && !pagina.data.encontrado ? (
          <p className="rounded-xl bg-surface p-6 text-sm text-ink-muted">Este link não existe.</p>
        ) : null}
        {!pagina.loading && pagina.data?.encontrado ? (
          fotos.length > 0 ? (
            <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fotos.map((url, indice) => (
                <li key={`${url}-${indice}`} className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in"
                    aria-label={`Abrir foto ${indice + 1}`}
                    onClick={() => setAberta(indice)}
                  >
                    <img src={url} alt="" className="aspect-square w-full bg-surface-subtle object-contain" />
                  </button>
                </li>
              ))}
            </ul>
            {aberta != null ? (
              <VisualizadorFotos fotos={fotos} indice={aberta} onIndice={setAberta} onFechar={() => setAberta(null)} />
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

function VisualizadorFotos({
  fotos,
  indice,
  onIndice,
  onFechar,
}: {
  fotos: string[];
  indice: number;
  onIndice: (indice: number) => void;
  onFechar: () => void;
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
