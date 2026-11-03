import { useEffect, useRef, useState, type ReactNode } from "react";
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
  /** Esconde o atalho "Ver modelo" (ex.: dentro de um assistente que perderia o que foi preenchido). */
  semLinkModelo?: boolean;
  /** Ações extras no rodapé para a imagem atual (ex.: abrir os itens de estoque). */
  acoesRodape?: (imagem: ImagemDetalhada) => ReactNode;
  /** Desliga Esc e setas (ex.: com um modal aberto por cima). */
  teclasPausadas?: boolean;
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
  semLinkModelo = false,
  acoesRodape,
  teclasPausadas = false,
}: GaleriaImagensLightboxProps) {
  const toqueInicioX = useRef<number | null>(null);
  const total = imagens.length;
  const atual = total > 0 ? imagens[Math.min(Math.max(indice, 0), total - 1)]! : null;
  const src = urlImagemModelo(atual);
  const [carregadas, setCarregadas] = useState<Set<string>>(() => new Set());
  const carregando = Boolean(src) && !carregadas.has(src!);

  // As fotos são grandes (até ~2 MB): baixa todas ao abrir, começando pela atual e
  // pelas vizinhas, para a navegação não esperar o download de cada uma.
  useEffect(() => {
    if (imagens.length === 0) return;
    let cancelado = false;
    const inicio = Math.min(Math.max(indice, 0), imagens.length - 1);
    const ordem: number[] = [];
    for (let d = 0; d < imagens.length; d += 1) {
      for (const i of [inicio + d, inicio - d]) {
        const pos = (i + imagens.length) % imagens.length;
        if (!ordem.includes(pos)) ordem.push(pos);
      }
    }
    for (const pos of ordem) {
      const url = urlImagemModelo(imagens[pos]);
      if (!url) continue;
      const img = new Image();
      img.onload = () => {
        if (!cancelado) setCarregadas((atuais) => new Set(atuais).add(url));
      };
      img.src = url;
    }
    return () => {
      cancelado = true;
    };
    // Só ao trocar o conjunto de fotos; a navegação usa o que já foi baixado.
  }, [imagens]);
  const nome = atual?.modelo?.nome_modelo ?? "—";
  const categoria = atual?.modelo?.categoria?.nome;

  const irAnterior = () => onIndiceChange(indice <= 0 ? total - 1 : indice - 1);
  const irProxima = () => onIndiceChange(indice >= total - 1 ? 0 : indice + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (teclasPausadas) return;
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
  }, [indice, total, onClose, onIndiceChange, teclasPausadas]);

  if (!atual) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95">
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

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-1 py-2 sm:px-14"
        onTouchStart={(e) => {
          toqueInicioX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const inicio = toqueInicioX.current;
          toqueInicioX.current = null;
          const fim = e.changedTouches[0]?.clientX;
          if (inicio == null || fim == null || total <= 1) return;
          const delta = fim - inicio;
          if (Math.abs(delta) < 40) return;
          if (delta > 0) irAnterior();
          else irProxima();
        }}
      >
        {src ? (
          <img
            key={src}
            src={src}
            alt={nome}
            onLoad={() => setCarregadas((atuais) => new Set(atuais).add(src))}
            className={cn(
              "max-h-full max-w-full object-contain transition-opacity duration-150",
              carregando ? "opacity-0" : "opacity-100",
            )}
          />
        ) : (
          <p className="text-sm text-white/50">Imagem indisponível</p>
        )}
        {carregando ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-label="Carregando foto">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          </span>
        ) : null}

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

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-3">
        {acoesRodape?.(atual)}
        {atual.modelo && !semLinkModelo ? (
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
