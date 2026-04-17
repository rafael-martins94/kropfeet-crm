/**
 * Integração com a API pública AwesomeAPI (economia.awesomeapi.com.br).
 *
 * - Gratuita, sem chave de API.
 * - CORS liberado (pode ser chamada direto do navegador).
 * - Pares no formato `XXX-YYY` (ex.: `USD-BRL`, `CNY-BRL`, `EUR-BRL`).
 *
 * Docs: https://docs.awesomeapi.com.br/api-de-moedas
 */

export interface CotacaoAtual {
  moedaOrigem: string;
  moedaDestino: string;
  valor: number;
  dataCotacao: string;
  fonte: string;
  bid: number;
  ask: number;
  high: number;
  low: number;
  variacaoPercentual: number;
}

interface RespostaAwesomeAPI {
  code: string;
  codein: string;
  name: string;
  high: string;
  low: string;
  varBid: string;
  pctChange: string;
  bid: string;
  ask: string;
  timestamp: string;
  create_date: string;
}

function parseNumero(valor: string): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function parseDataAPI(data: string): string {
  const match = data.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return new Date().toISOString().slice(0, 10);
}

export const cotacaoApi = {
  async buscarCotacaoAtual(
    moedaOrigem: string,
    moedaDestino: string,
  ): Promise<CotacaoAtual> {
    const origem = moedaOrigem.trim().toUpperCase();
    const destino = moedaDestino.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(origem) || !/^[A-Z]{3}$/.test(destino)) {
      throw new Error(
        "Informe códigos ISO 4217 de 3 letras (ex.: USD, BRL, EUR, CNY).",
      );
    }

    const url = `https://economia.awesomeapi.com.br/json/last/${origem}-${destino}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error(`Par ${origem}→${destino} não disponível na AwesomeAPI.`);
      }
      throw new Error(
        `Falha ao consultar AwesomeAPI (${resp.status} ${resp.statusText}).`,
      );
    }

    const json = (await resp.json()) as Record<string, RespostaAwesomeAPI>;
    const chave = `${origem}${destino}`;
    const dados = json[chave];

    if (!dados) {
      throw new Error(`Resposta da API não contém o par ${origem}→${destino}.`);
    }

    return {
      moedaOrigem: dados.code,
      moedaDestino: dados.codein,
      valor: parseNumero(dados.bid),
      dataCotacao: parseDataAPI(dados.create_date),
      fonte: "AwesomeAPI",
      bid: parseNumero(dados.bid),
      ask: parseNumero(dados.ask),
      high: parseNumero(dados.high),
      low: parseNumero(dados.low),
      variacaoPercentual: parseNumero(dados.pctChange),
    };
  },

  async buscarVariosPares(
    pares: Array<{ origem: string; destino: string }>,
  ): Promise<CotacaoAtual[]> {
    const resultados = await Promise.allSettled(
      pares.map((p) => cotacaoApi.buscarCotacaoAtual(p.origem, p.destino)),
    );
    return resultados
      .filter(
        (r): r is PromiseFulfilledResult<CotacaoAtual> => r.status === "fulfilled",
      )
      .map((r) => r.value);
  },
};
