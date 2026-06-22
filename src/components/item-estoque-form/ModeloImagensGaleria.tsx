import { useCallback, useEffect, useMemo, useState } from "react";
import { IconImage } from "../Icons";
import { cn } from "../../utils/cn";
import { urlImagemModelo } from "../../utils/imagemModelo";
import type { ImagemModeloProduto } from "../../types/entities";

type AspectRatioGaleria = "4/5" | "16/9";

type ModeloImagensGaleriaProps = {
  idModelo?: string;
  imagens: ImagemModeloProduto[];
  nomeModelo?: string;
  loading?: boolean;
  className?: string;
  /** Proporção do visor principal e das miniaturas. */
  aspectRatio?: AspectRatioGaleria;
  /** Setas do teclado (← →) para trocar foto. */
  keyboardNav?: boolean;
};

const ASPECT_CLASS: Record<AspectRatioGaleria, string> = {
  "4/5": "aspect-[4/5]",
  "16/9": "aspect-video",
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={direction === "prev" ? "Imagem anterior" : "Próxima imagem"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-line/80 bg-surface/95 text-ink shadow-sm transition",
        "hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {direction === "prev" ? (
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

export function ModeloImagensGaleria({
  idModelo,
  imagens,
  nomeModelo,
  loading,
  className,
  aspectRatio = "4/5",
  keyboardNav = false,
}: ModeloImagensGaleriaProps) {
  const [indice, setIndice] = useState(0);

  const aspectClass = ASPECT_CLASS[aspectRatio];
  const imagemWide = aspectRatio === "16/9";

  const indicePrincipal = useMemo(() => {
    const idx = imagens.findIndex((img) => img.imagem_principal);
    return idx >= 0 ? idx : 0;
  }, [imagens]);

  useEffect(() => {
    setIndice(indicePrincipal);
  }, [idModelo, indicePrincipal]);

  const total = imagens.length;
  const atual = total > 0 ? imagens[Math.min(indice, total - 1)]! : null;
  const srcAtual = urlImagemModelo(atual);

  const irAnterior = useCallback(
    () => setIndice((i) => (i <= 0 ? total - 1 : i - 1)),
    [total],
  );
  const irProxima = useCallback(
    () => setIndice((i) => (i >= total - 1 ? 0 : i + 1)),
    [total],
  );

  useEffect(() => {
    if (!keyboardNav || total <= 1) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        irAnterior();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        irProxima();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboardNav, total, irAnterior, irProxima]);

  const placeholderClass = cn(
    aspectClass,
    "w-full rounded-2xl border border-dashed border-line bg-surface-muted/40",
  );

  if (!idModelo) {
    return (
      <div
        className={cn(
          placeholderClass,
          "flex flex-col items-center justify-center gap-2 p-6 text-center",
          className,
        )}
      >
        <IconImage width={32} height={32} className="text-ink-faint" />
        <p className="text-sm text-ink-soft">Selecione um modelo para ver as fotos</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          aspectClass,
          "w-full animate-pulse rounded-2xl border border-line bg-surface-muted/60",
          className,
        )}
        aria-label="Carregando imagens"
      />
    );
  }

  if (total === 0) {
    return (
      <div
        className={cn(
          placeholderClass,
          "flex flex-col items-center justify-center gap-2 p-6 text-center",
          className,
        )}
      >
        <IconImage width={32} height={32} className="text-ink-faint" />
        <p className="text-sm font-medium text-ink">{nomeModelo ?? "Modelo"}</p>
        <p className="text-xs text-ink-soft">Sem imagens cadastradas</p>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-line bg-surface-subtle shadow-sm",
          aspectClass,
        )}
        tabIndex={keyboardNav && total > 1 ? 0 : undefined}
        aria-label={nomeModelo ? `Fotos de ${nomeModelo}` : "Fotos do modelo"}
      >
        {srcAtual ? (
          <img
            key={`${idModelo}-${atual?.id}-${indice}`}
            src={srcAtual}
            alt={nomeModelo ? `${nomeModelo} — foto ${indice + 1}` : "Foto do modelo"}
            className={cn(
              "h-full w-full",
              imagemWide ? "object-contain" : "object-cover",
            )}
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">
            <IconImage width={40} height={40} />
          </div>
        )}

        {atual?.imagem_principal ? (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-brand-900/80 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-white">
            Principal
          </span>
        ) : null}

        {total > 1 ? (
          <>
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-[1] w-[28%] cursor-w-resize opacity-0 focus-visible:opacity-100"
              aria-label="Imagem anterior"
              onClick={irAnterior}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-[1] w-[28%] cursor-e-resize opacity-0 focus-visible:opacity-100"
              aria-label="Próxima imagem"
              onClick={irProxima}
            />

            <div className="absolute inset-y-0 left-2 z-[2] flex items-center">
              <ChevronBtn direction="prev" onClick={irAnterior} />
            </div>
            <div className="absolute inset-y-0 right-2 z-[2] flex items-center">
              <ChevronBtn direction="next" onClick={irProxima} />
            </div>

            <span className="absolute bottom-2 right-2 z-10 rounded-full bg-brand-900/70 px-2.5 py-0.5 text-[0.65rem] font-medium tabular-nums text-white">
              {indice + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {imagens.map((img, i) => {
            const src = urlImagemModelo(img);
            const ativo = i === indice;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Foto ${i + 1}${img.imagem_principal ? " (principal)" : ""}`}
                aria-current={ativo}
                className={cn(
                  "relative shrink-0 overflow-hidden rounded-lg border-2 bg-surface-subtle transition",
                  imagemWide ? cn("aspect-video w-24", ativo ? "border-brand-500 ring-2 ring-brand-500/25" : "border-line opacity-75 hover:opacity-100") : cn("h-14 w-14", ativo ? "border-brand-500 ring-2 ring-brand-500/25" : "border-transparent opacity-70 hover:opacity-100"),
                )}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    className={cn("h-full w-full", imagemWide ? "object-contain" : "object-cover")}
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-faint">
                    <IconImage width={14} height={14} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {nomeModelo && !imagemWide ? (
        <p className="truncate text-center text-xs font-medium text-ink-soft">{nomeModelo}</p>
      ) : null}

      {keyboardNav && total > 1 ? (
        <p className="text-center text-[0.65rem] text-ink-faint">
          Use ← → ou clique nas laterais da foto
        </p>
      ) : null}
    </div>
  );
}
