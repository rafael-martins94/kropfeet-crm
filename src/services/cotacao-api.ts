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

export interface CotacaoHistorica {
  moedaOrigem: string;
  moedaDestino: string;
  valor: number;
  dataCotacao: string;
  fonte: string;
}

interface RespostaDiariaAwesomeAPI {
  bid: string;
  timestamp: string;
}

const cacheHistorico = new Map<string, Promise<CotacaoHistorica | null>>();

function dataIsoSemHifen(dataIso: string): string {
  return dataIso.replace(/-/g, "");
}

function subtrairDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia - dias));
  return data.toISOString().slice(0, 10);
}

function dataDoTimestamp(timestamp: string): string {
  // Fechamento diário vem perto da meia-noite UTC; o dia que vale é o de Brasília.
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

export const cotacaoApi = {
  /**
   * Cotação de fechamento do dia informado. Em fim de semana ou feriado usa o
   * último dia útil anterior (busca até 7 dias para trás).
   */
  buscarCotacaoHistorica(
    moedaOrigem: string,
    moedaDestino: string,
    dataIso: string,
  ): Promise<CotacaoHistorica | null> {
    const origem = moedaOrigem.trim().toUpperCase();
    const destino = moedaDestino.trim().toUpperCase();
    const chave = `${origem}-${destino}-${dataIso}`;
    const emCache = cacheHistorico.get(chave);
    if (emCache) return emCache;

    const busca = (async () => {
      const inicio = dataIsoSemHifen(subtrairDias(dataIso, 7));
      const fim = dataIsoSemHifen(dataIso);
      const url = `https://economia.awesomeapi.com.br/json/daily/${origem}-${destino}/10?start_date=${inicio}&end_date=${fim}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Falha ao consultar AwesomeAPI (${resp.status} ${resp.statusText}).`);
      }
      const lista = (await resp.json()) as RespostaDiariaAwesomeAPI[];
      const maisRecente = Array.isArray(lista) ? lista[0] : undefined;
      if (!maisRecente) return null;
      const valor = parseNumero(maisRecente.bid);
      if (!valor) return null;
      return {
        moedaOrigem: origem,
        moedaDestino: destino,
        valor,
        dataCotacao: dataDoTimestamp(maisRecente.timestamp),
        fonte: "AwesomeAPI",
      };
    })();

    cacheHistorico.set(chave, busca);
    busca.catch(() => cacheHistorico.delete(chave));
    return busca;
  },

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
