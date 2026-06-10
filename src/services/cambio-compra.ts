import { cambiosMoedaService } from "./cambios-moeda";
import { cotacaoApi } from "./cotacao-api";

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

export function mensagemCotacaoIndisponivel(dataCompra: string): string {
  if (dataCompra === hojeIso()) {
    return "Não foi possível obter a cotação atual. Cadastre em Câmbio de moeda ou tente novamente.";
  }
  return `Não há cotação cadastrada para ${dataCompra}. Cadastre em Operação → Câmbio de moeda.`;
}
