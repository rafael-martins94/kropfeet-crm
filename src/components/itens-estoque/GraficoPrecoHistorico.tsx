import { formatarDataHora, formatarMoeda } from "../../utils/format";
import type { PontoGraficoPreco } from "../../utils/historicoPreco";

type GraficoPrecoHistoricoProps = {
  pontos: PontoGraficoPreco[];
  moedaPadrao?: string | null;
};

export function GraficoPrecoHistorico({ pontos, moedaPadrao = "EUR" }: GraficoPrecoHistoricoProps) {
  if (pontos.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-line bg-surface-muted/40 text-sm text-ink-soft">
        Sem alterações registradas para exibir no gráfico.
      </div>
    );
  }

  const moeda = pontos[0]?.moeda ?? moedaPadrao ?? "EUR";
  const width = 640;
  const height = 220;
  const pad = { top: 20, right: 20, bottom: 36, left: 52 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const tempos = pontos.map((p) => p.data.getTime());
  const valores = pontos.map((p) => p.valor);
  const minT = Math.min(...tempos);
  const maxT = Math.max(...tempos);
  const minV = Math.min(...valores);
  const maxV = Math.max(...valores);
  const faixaT = maxT - minT || 1;
  const faixaV = maxV - minV || Math.max(maxV * 0.1, 1);

  const coords = pontos.map((p) => ({
    x: pad.left + ((p.data.getTime() - minT) / faixaT) * chartW,
    y: pad.top + (1 - (p.valor - minV) / faixaV) * chartH,
    ponto: p,
  }));

  const linha = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${linha} L ${coords[coords.length - 1]?.x.toFixed(1) ?? pad.left} ${(pad.top + chartH).toFixed(1)} L ${coords[0]?.x.toFixed(1) ?? pad.left} ${(pad.top + chartH).toFixed(1)} Z`;

  const ticksY = 4;
  const linhasY = Array.from({ length: ticksY + 1 }, (_, i) => {
    const valor = minV + (faixaV * i) / ticksY;
    const y = pad.top + (1 - i / ticksY) * chartH;
    return { valor, y };
  });

  return (
    <div className="rounded-xl border border-line bg-surface-muted/20 p-3">
      <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        Evolução do preço ({moeda})
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Gráfico de evolução do preço">
        {linhasY.map((tick) => (
          <g key={tick.y}>
            <line
              x1={pad.left}
              y1={tick.y}
              x2={width - pad.right}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
            <text
              x={pad.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-ink-soft text-[10px] font-numeric"
            >
              {formatarMoeda(tick.valor, moeda).replace(/\s/g, "\u00a0")}
            </text>
          </g>
        ))}
        <path d={area} fill="rgb(11 63 92 / 0.08)" />
        <path d={linha} fill="none" stroke="#0B3F5C" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, index) => (
          <g key={`${c.ponto.data.toISOString()}-${index}`}>
            <circle cx={c.x} cy={c.y} r={5} fill="#0B3F5C" stroke="#fff" strokeWidth={2} />
            <title>
              {formatarDataHora(c.ponto.data.toISOString())} — {formatarMoeda(c.ponto.valor, c.ponto.moeda)}
            </title>
          </g>
        ))}
        {coords.length === 1 ? (
          <text x={width / 2} y={height - 10} textAnchor="middle" className="fill-ink-soft text-[10px]">
            {formatarDataHora(coords[0].ponto.data.toISOString())}
          </text>
        ) : (
          <>
            <text x={pad.left} y={height - 10} className="fill-ink-soft text-[10px]">
              {formatarDataHora(new Date(minT).toISOString())}
            </text>
            <text x={width - pad.right} y={height - 10} textAnchor="end" className="fill-ink-soft text-[10px]">
              {formatarDataHora(new Date(maxT).toISOString())}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
