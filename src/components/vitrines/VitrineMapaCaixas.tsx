import type { VitrineItemDetalhado } from "../../services/vitrines";
import { cn } from "../../utils/cn";
import { MAPA_CAIXAS } from "./mapaCaixas";
import { fotoItemVitrine, nomeNoPdf } from "./VitrineShared";

export function VitrineMapaCaixas({
  itens,
  thumbs,
}: {
  itens: VitrineItemDetalhado[];
  thumbs?: Record<string, string> | null;
}) {
  const porCaixa = new Map(
    itens
      .filter((item) => item.numero_caixa != null)
      .map((item) => [item.numero_caixa as number, item]),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="relative mx-auto h-[32rem] min-w-[70rem] max-w-[78rem] px-2 pt-3">
          {MAPA_CAIXAS.map(({ numero, left, top }) => {
            const item = porCaixa.get(numero);
            const vendida = item?.estado_caixa === "vendida";
            const nome = item ? nomeNoPdf(item) : "Vazia";
            const foto = item ? fotoItemVitrine(item, thumbs) : null;
            return (
              <div
                key={numero}
                title={item ? `Caixa ${numero} · ${nome}` : `Caixa ${numero} vazia`}
                className={cn(
                  "absolute h-24 w-24 -translate-x-1/2 rounded-xl border-2 bg-white shadow-sm",
                  vendida ? "border-amber-400 bg-amber-50" : item ? "border-brand-500 bg-brand-50" : "border-ink",
                )}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <div className="absolute -left-3 -top-3 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-brand-700 px-2 text-sm font-bold text-white shadow-md ring-2 ring-white">
                  {numero}
                </div>
                {item ? (
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
                      <div className="flex h-full w-full items-center justify-center px-2 pb-5 pt-2">
                        <span className="line-clamp-3 text-[9px] leading-tight text-brand-900/80">{nome}</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "absolute inset-x-1 bottom-1 rounded-md px-1.5 py-1 shadow-sm",
                        vendida ? "bg-amber-700" : "bg-brand-700",
                      )}
                    >
                      <span className="block truncate text-[9px] font-bold leading-none text-white">
                        {vendida ? "Vendido" : item.item?.sku ?? "SKU"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-ink-soft">
                    Vazia
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
