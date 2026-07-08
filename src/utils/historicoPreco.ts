import type { ItemEstoquePrecoHistorico } from "../services/itens-estoque";

export type PontoGraficoPreco = {
  data: Date;
  valor: number;
  moeda: string;
};

const ROTULOS_ORIGEM: Record<string, string> = {
  manual: "Manual",
  vitrine_correspondencias: "Vitrine — correspondências",
  cadastro_inicial: "Cadastro inicial",
};

export function rotuloOrigemPreco(origem: string): string {
  return ROTULOS_ORIGEM[origem] ?? origem.replace(/_/g, " ");
}

/** Pontos ordenados no tempo para o gráfico de linha. */
export function montarPontosGraficoPreco(
  historico: ItemEstoquePrecoHistorico[],
  precoAtual?: number | null,
  moedaAtual?: string | null,
): PontoGraficoPreco[] {
  const ordenado = [...historico].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  );
  const pontos: PontoGraficoPreco[] = [];

  if (ordenado.length > 0 && ordenado[0].preco_anterior != null) {
    pontos.push({
      data: new Date(ordenado[0].criado_em),
      valor: ordenado[0].preco_anterior,
      moeda: ordenado[0].moeda_anterior ?? ordenado[0].moeda_nova ?? "EUR",
    });
  }

  for (const registro of ordenado) {
    if (registro.preco_novo != null) {
      pontos.push({
        data: new Date(registro.criado_em),
        valor: registro.preco_novo,
        moeda: registro.moeda_nova ?? registro.moeda_anterior ?? "EUR",
      });
    }
  }

  if (precoAtual != null && pontos.length > 0) {
    const ultimo = pontos[pontos.length - 1];
    if (ultimo.valor !== precoAtual) {
      pontos.push({
        data: new Date(),
        valor: precoAtual,
        moeda: moedaAtual ?? ultimo.moeda,
      });
    }
  }

  return pontos;
}
