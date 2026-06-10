import { useEffect, useMemo, useState } from "react";
import { IconImage } from "../Icons";
import { cn } from "../../utils/cn";
import { urlImagemModelo } from "../../utils/imagemModelo";
import type { ImagemModeloProduto } from "../../types/entities";

type ModeloImagensGaleriaProps = {
  idModelo?: string;
  imagens: ImagemModeloProduto[];
  nomeModelo?: string;
  loading?: boolean;
  className?: string;
};

function ChevronBtn({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Imagem anterior" : "Próxima imagem"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-line/80 bg-surface/95 text-ink shadow-sm transition",
        "hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
        "disabled:pointer-events-none disabled:opacity-30",
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
}: ModeloImagensGaleriaProps) {
  const [indice, setIndice] = useState(0);

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

  const irAnterior = () => setIndice((i) => (i <= 0 ? total - 1 : i - 1));
  const irProxima = () => setIndice((i) => (i >= total - 1 ? 0 : i + 1));

  if (!idModelo) {
    return (
      <div
        className={cn(
          "flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-muted/40 p-6 text-center",
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
          "aspect-[4/5] w-full animate-pulse rounded-2xl border border-line bg-surface-muted/60",
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
          "flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-muted/40 p-6 text-center",
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
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface-subtle shadow-sm">
        {srcAtual ? (
          <img
            key={`${idModelo}-${atual?.id}-${indice}`}
            src={srcAtual}
            alt={nomeModelo ? `${nomeModelo} — foto ${indice + 1}` : "Foto do modelo"}
            className="h-full w-full object-cover"
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
          <span className="absolute left-2 top-2 rounded-full bg-brand-900/80 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-white">
            Principal
          </span>
        ) : null}

        {total > 1 ? (
          <>
            <div className="absolute inset-y-0 left-2 flex items-center">
              <ChevronBtn direction="prev" onClick={irAnterior} disabled={false} />
            </div>
            <div className="absolute inset-y-0 right-2 flex items-center">
              <ChevronBtn direction="next" onClick={irProxima} disabled={false} />
            </div>
            <span className="absolute bottom-2 right-2 rounded-full bg-brand-900/70 px-2 py-0.5 text-[0.65rem] font-medium tabular-nums text-white">
              {indice + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
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
                  "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-surface-subtle transition",
                  ativo ? "border-brand-500 ring-2 ring-brand-500/25" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
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

      {nomeModelo ? (
        <p className="truncate text-center text-xs font-medium text-ink-soft">{nomeModelo}</p>
      ) : null}
    </div>
  );
}
