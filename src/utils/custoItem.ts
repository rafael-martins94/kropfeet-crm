import type { ItemEstoque } from "../types/entities";
import type { OrdemCompra } from "../types/entities";

export type FonteCustoItem = "ordem" | "legado_tiny";

export interface CustoItemEstoque {
  fonte: FonteCustoItem;
  valorReal: number | null;
  valorEuro: number | null;
  valorOriginal: number | null;
  moedaOriginal: string | null;
}

type ItemComOrdem = Pick<ItemEstoque, "id_ordem_compra" | "valor_pago_original"> & {
  ordem_compra?: Pick<
    OrdemCompra,
    "valor_pago_real" | "valor_pago_euro" | "valor_pago_original" | "moeda_compra"
  > | null;
};

/** Resolve custo do item: ordem de compra quando existir; senão valor Tiny legado (BRL implícito). */
export function resolverCustoItem(item: ItemComOrdem | null | undefined): CustoItemEstoque | null {
  if (!item) return null;

  const ordem = item.ordem_compra;
  if (item.id_ordem_compra && ordem) {
    return {
      fonte: "ordem",
      valorReal: ordem.valor_pago_real,
      valorEuro: ordem.valor_pago_euro,
      valorOriginal: ordem.valor_pago_original,
      moedaOriginal: ordem.moeda_compra,
    };
  }

  if (item.valor_pago_original !== null && item.valor_pago_original !== undefined) {
    return {
      fonte: "legado_tiny",
      valorReal: item.valor_pago_original,
      valorEuro: null,
      valorOriginal: item.valor_pago_original,
      moedaOriginal: "BRL",
    };
  }

  return null;
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
