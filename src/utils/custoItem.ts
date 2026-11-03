import type { ItemEstoque } from "../types/entities";
import type { OrdemCompra } from "../types/entities";
import { inferirMoedaVendaPorRegiao } from "./moedaItemEstoque";

export type FonteCustoItem = "ordem";

export interface CustoItemEstoque {
  fonte: FonteCustoItem;
  valorReal: number | null;
  valorEuro: number | null;
  valorOriginal: number | null;
  moedaOriginal: string | null;
  /** Presente quando valorReal foi convertido de outra moeda. */
  cotacaoReal?: { valor: number; dataCotacao: string; fonte: string } | null;
}

/** Item em estoque no Brasil comprado em outra moeda: custo precisa de conversão para real. */
export function precisaConverterCustoParaReal(
  custo: CustoItemEstoque | null | undefined,
  tipoRegiao?: string | null,
): boolean {
  return Boolean(
    custo &&
      custo.valorReal == null &&
      custo.valorOriginal != null &&
      custo.moedaOriginal &&
      custo.moedaOriginal !== "BRL" &&
      inferirMoedaVendaPorRegiao(tipoRegiao) === "BRL",
  );
}

type ItemComOrdem = Pick<ItemEstoque, "id_ordem_compra"> & {
  local?: { tipo_regiao?: string | null } | null;
  ordem_compra?: Pick<OrdemCompra, "valor_custo" | "moeda_compra"> | null;
};

/** Resolve custo do item a partir da ordem de compra vinculada. */
export function resolverCustoItem(item: ItemComOrdem | null | undefined): CustoItemEstoque | null {
  if (!item) return null;

  const ordem = item.ordem_compra;
  if (item.id_ordem_compra && ordem) {
    return {
      fonte: "ordem",
      valorReal: ordem.moeda_compra === "BRL" ? ordem.valor_custo : null,
      valorEuro: ordem.moeda_compra === "EUR" ? ordem.valor_custo : null,
      valorOriginal: ordem.valor_custo,
      moedaOriginal: ordem.moeda_compra,
    };
  }

  return null;
}

/** Valor e moeda de custo a exibir conforme a região do local. */
export function obterCustoPrincipal(
  custo: CustoItemEstoque | null | undefined,
  tipoRegiao?: string | null,
): { valor: number; moeda: string } | null {
  if (!custo) return null;

  const moeda = inferirMoedaVendaPorRegiao(tipoRegiao) ?? custo.moedaOriginal ?? "BRL";

  if (moeda === "EUR") {
    const valor = custo.valorEuro ?? (custo.moedaOriginal === "EUR" ? custo.valorOriginal : null);
    return valor != null ? { valor, moeda: "EUR" } : null;
  }

  const valor = custo.valorReal ?? (custo.moedaOriginal === "BRL" ? custo.valorOriginal : null);
  return valor != null ? { valor, moeda: "BRL" } : null;
}

export function calcularLucroVenda(
  valorVendaReal: number | null | undefined,
  valorVendaEuro: number | null | undefined,
  custo: CustoItemEstoque | null,
): { lucroReal: number | null; lucroEuro: number | null } {
  const lucroReal =
    valorVendaReal != null && custo?.valorReal != null
      ? Math.round((valorVendaReal - custo.valorReal) * 100) / 100
      : null;
  const lucroEuro =
    valorVendaEuro != null && custo?.valorEuro != null
      ? Math.round((valorVendaEuro - custo.valorEuro) * 100) / 100
      : null;
  return { lucroReal, lucroEuro };
}
