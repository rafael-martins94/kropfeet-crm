import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { IconX } from "../Icons";
import { cn } from "../../utils/cn";
import { urlImagemModelo } from "../../utils/imagemModelo";
import type { ImagemDetalhada } from "../../services/imagens";

type GaleriaImagensLightboxProps = {
  imagens: ImagemDetalhada[];
  indice: number;
  onClose: () => void;
  onIndiceChange: (indice: number) => void;
};

function ChevronBtn({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Imagem anterior" : "Próxima imagem"}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-lg transition",
        "hover:bg-black/70 hover:border-white/40",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {direction === "prev" ? (
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

export function GaleriaImagensLightbox({
  imagens,
  indice,
  onClose,
  onIndiceChange,
}: GaleriaImagensLightboxProps) {
  const total = imagens.length;
  const atual = total > 0 ? imagens[Math.min(Math.max(indice, 0), total - 1)]! : null;
  const src = urlImagemModelo(atual);
  const nome = atual?.modelo?.nome_modelo ?? "—";
  const categoria = atual?.modelo?.categoria?.nome;

  const irAnterior = () => onIndiceChange(indice <= 0 ? total - 1 : indice - 1);
  const irProxima = () => onIndiceChange(indice >= total - 1 ? 0 : indice + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (total <= 1) return;
      if (e.key === "ArrowLeft") onIndiceChange(indice <= 0 ? total - 1 : indice - 1);
      if (e.key === "ArrowRight") onIndiceChange(indice >= total - 1 ? 0 : indice + 1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [indice, total, onClose, onIndiceChange]);

  if (!atual) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nome}</p>
          {categoria ? (
            <p className="truncate text-xs text-white/60">{categoria}</p>
          ) : null}
        </div>
        {total > 1 ? (
          <span className="shrink-0 text-xs tabular-nums text-white/70">
            {indice + 1} / {total}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <IconX width={20} height={20} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 py-2">
        {src ? (
          <img
            src={src}
            alt={nome}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-white/50">Imagem indisponível</p>
        )}

        {atual.imagem_principal ? (
          <span className="absolute left-4 top-2 rounded-full bg-brand-700/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Principal
          </span>
        ) : null}

        {total > 1 ? (
          <>
            <div className="absolute inset-y-0 left-3 flex items-center">
              <ChevronBtn direction="prev" onClick={irAnterior} />
            </div>
            <div className="absolute inset-y-0 right-3 flex items-center">
              <ChevronBtn direction="next" onClick={irProxima} />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-4 border-t border-white/10 px-4 py-3">
        {atual.modelo ? (
          <Link
            to={`/modelos-produto/${atual.modelo.id}`}
            className="text-xs font-medium text-brand-300 transition hover:text-brand-200"
            onClick={onClose}
          >
            Ver modelo
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-white/60 transition hover:text-white"
        >
          Fechar
        </button>
      </div>
    </div>,
    document.body,
  );
}
