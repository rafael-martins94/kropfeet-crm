import { useRef, useState, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight } from "../Icons";
import { normalizarUrlImagemValor } from "../../utils/imagemModelo";

export function FotosTenisCarrossel({
  fotos,
  fotoPrincipal,
  children,
}: {
  fotos?: string[] | null;
  fotoPrincipal?: string | null;
  children?: ReactNode;
}) {
  const urls = (fotos?.length ? fotos : [fotoPrincipal])
    .map((foto) => normalizarUrlImagemValor(foto))
    .filter((url): url is string => Boolean(url));
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

  const irPara = (indice: number) => {
    const el = trilho.current;
    if (!el) return;
    const destino = Math.max(0, Math.min(urls.length - 1, indice));
    el.scrollTo({ left: destino * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="group relative aspect-[4/3] bg-surface-subtle">
      {urls.length > 0 ? (
        <div
          ref={trilho}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(evento) => {
            const el = evento.currentTarget;
            if (el.clientWidth > 0) setAtual(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {urls.map((url, indice) => (
            <img
              key={`${url}-${indice}`}
              src={url}
              alt=""
              loading={indice === 0 ? "eager" : "lazy"}
              draggable={false}
              className="h-full w-full shrink-0 snap-center object-cover"
            />
          ))}
        </div>
      ) : null}

      {urls.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            disabled={atual === 0}
            onClick={() => irPara(atual - 1)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <IconChevronLeft width={18} height={18} />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            disabled={atual >= urls.length - 1}
            onClick={() => irPara(atual + 1)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <IconChevronRight width={18} height={18} />
          </button>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 font-numeric text-[11px] font-semibold text-white">
            {atual + 1}/{urls.length}
          </span>
        </>
      ) : null}

      {children}
    </div>
  );
}
