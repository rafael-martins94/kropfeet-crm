import { cambiosMoedaService } from "./cambios-moeda";
import { cotacaoApi } from "./cotacao-api";
import type { CustoItemEstoque } from "../utils/custoItem";

export interface CotacaoCompra {
  moedaOrigem: string;
  moedaDestino: string;
  valorCotacao: number;
  dataCotacao: string;
  fonte: string;
}

export interface ValoresCompraCalculados {
  cambioParaReal: number | null;
  cambioParaEuro: number | null;
  valorReal: number | null;
  valorEuro: number | null;
  cotacaoReal: CotacaoCompra | null;
  cotacaoEuro: CotacaoCompra | null;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function arredondarCambio(valor: number): number {
  return Math.round(valor * 1_000_000) / 1_000_000;
}

async function buscarCotacaoNaData(
  origem: string,
  destino: string,
  dataCompra: string,
): Promise<CotacaoCompra | null> {
  const o = origem.trim().toUpperCase();
  const d = destino.trim().toUpperCase();
  if (o === d) {
    return {
      moedaOrigem: o,
      moedaDestino: d,
      valorCotacao: 1,
      dataCotacao: dataCompra,
      fonte: "paridade",
    };
  }

  const doBanco = await cambiosMoedaService.buscarCotacaoNaData(o, d, dataCompra);
  if (doBanco) {
    return {
      moedaOrigem: doBanco.moeda_origem,
      moedaDestino: doBanco.moeda_destino,
      valorCotacao: Number(doBanco.valor_cotacao),
      dataCotacao: doBanco.data_cotacao,
      fonte: doBanco.fonte ?? "cadastro",
    };
  }

  if (dataCompra === hojeIso()) {
    const api = await cotacaoApi.buscarCotacaoAtual(o, d);
    return {
      moedaOrigem: api.moedaOrigem,
      moedaDestino: api.moedaDestino,
      valorCotacao: api.valor,
      dataCotacao: api.dataCotacao,
      fonte: api.fonte,
    };
  }

  return null;
}

export async function calcularValoresCompra(
  moedaCompra: string,
  valorOriginal: number,
  dataCompra: string,
): Promise<ValoresCompraCalculados> {
  const moeda = moedaCompra.trim().toUpperCase();
  if (!moeda || !Number.isFinite(valorOriginal)) {
    return {
      cambioParaReal: null,
      cambioParaEuro: null,
      valorReal: null,
      valorEuro: null,
      cotacaoReal: null,
      cotacaoEuro: null,
    };
  }

  const cotacaoReal = await buscarCotacaoNaData(moeda, "BRL", dataCompra);
  const cotacaoEuro = await buscarCotacaoNaData(moeda, "EUR", dataCompra);

  if (!cotacaoReal || !cotacaoEuro) {
    return {
      cambioParaReal: cotacaoReal?.valorCotacao ?? null,
      cambioParaEuro: cotacaoEuro?.valorCotacao ?? null,
      valorReal: cotacaoReal
        ? arredondarMoeda(valorOriginal * cotacaoReal.valorCotacao)
        : null,
      valorEuro: cotacaoEuro
        ? arredondarMoeda(valorOriginal * cotacaoEuro.valorCotacao)
        : null,
      cotacaoReal,
      cotacaoEuro,
    };
  }

  return {
    cambioParaReal: arredondarCambio(cotacaoReal.valorCotacao),
    cambioParaEuro: arredondarCambio(cotacaoEuro.valorCotacao),
    valorReal: arredondarMoeda(valorOriginal * cotacaoReal.valorCotacao),
    valorEuro: arredondarMoeda(valorOriginal * cotacaoEuro.valorCotacao),
    cotacaoReal,
    cotacaoEuro,
  };
}

/** Cadastro manual vale só se for de até 7 dias antes da compra; senão usa a API. */
const JANELA_COTACAO_CADASTRADA_DIAS = 7;

/** Cotação de uma moeda para real no dia da compra (cadastro manual ou AwesomeAPI). */
export async function buscarCotacaoParaRealNaData(
  moedaOrigem: string,
  dataCompra: string,
): Promise<{ valor: number; dataCotacao: string; fonte: string } | null> {
  const origem = moedaOrigem.trim().toUpperCase();
  const doBanco = await cambiosMoedaService.buscarCotacaoNaData(origem, "BRL", dataCompra);
  if (doBanco) {
    const diasAntes =
      (Date.parse(dataCompra) - Date.parse(doBanco.data_cotacao)) / 86_400_000;
    if (diasAntes <= JANELA_COTACAO_CADASTRADA_DIAS) {
      return {
        valor: Number(doBanco.valor_cotacao),
        dataCotacao: doBanco.data_cotacao,
        fonte: doBanco.fonte ?? "cadastro",
      };
    }
  }

  const api = await cotacaoApi.buscarCotacaoHistorica(origem, "BRL", dataCompra);
  return api ? { valor: api.valor, dataCotacao: api.dataCotacao, fonte: api.fonte } : null;
}

/** Preenche valorReal do custo com a cotação do dia da compra. Sem cotação, devolve o custo como veio. */
export async function converterCustoParaReal(
  custo: CustoItemEstoque,
  dataCompra: string | null | undefined,
): Promise<CustoItemEstoque> {
  if (!dataCompra || custo.valorOriginal == null || !custo.moedaOriginal) return custo;
  try {
    const cotacao = await buscarCotacaoParaRealNaData(custo.moedaOriginal, dataCompra);
    if (!cotacao) return custo;
    return {
      ...custo,
      valorReal: arredondarMoeda(custo.valorOriginal * cotacao.valor),
      cotacaoReal: cotacao,
    };
  } catch (erro) {
    console.warn("Não foi possível converter o custo para real:", erro);
    return custo;
  }
}

export function mensagemCotacaoIndisponivel(dataCompra: string): string {
  if (dataCompra === hojeIso()) {
    return "Não foi possível obter a cotação atual. Cadastre em Câmbio de moeda ou tente novamente.";
  }
  return `Não há cotação cadastrada para ${dataCompra}. Cadastre em Operação → Câmbio de moeda.`;
}
