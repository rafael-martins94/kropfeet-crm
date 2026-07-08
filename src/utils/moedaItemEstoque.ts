import type { TipoRegiao } from "../types/entities";
import { formatarMoeda } from "./format";

/** Moeda padrão de venda conforme a região do local de estoque. */
export function inferirMoedaVendaPorRegiao(
  tipoRegiao: TipoRegiao | string | null | undefined,
): "EUR" | "BRL" | null {
  if (tipoRegiao === "europa") return "EUR";
  if (tipoRegiao === "brasil") return "BRL";
  return null;
}

/** Usa a moeda explícita do item ou infere pela região do local. */
export function resolverMoedaVendaItem(
  moedaVenda: string | null | undefined,
  tipoRegiao: TipoRegiao | string | null | undefined,
): string | null {
  const explicita = moedaVenda?.trim().toUpperCase();
  if (explicita) return explicita;
  return inferirMoedaVendaPorRegiao(tipoRegiao);
}

/** Texto formatado do preço de venda ou null se não houver preço/moeda. */
export function formatarPrecoVendaItem(
  precoVenda: number | null | undefined,
  moedaVenda: string | null | undefined,
  tipoRegiaoLocal?: TipoRegiao | string | null,
): string | null {
  if (precoVenda == null) return null;
  const moeda = resolverMoedaVendaItem(moedaVenda, tipoRegiaoLocal);
  if (!moeda) return null;
  return formatarMoeda(precoVenda, moeda);
}

export type ItemComPrecoVenda = {
  preco_venda?: number | null;
  moeda_venda?: string | null;
  local?: { tipo_regiao?: string | null } | null;
};

/** Atalho para item com preco_venda, moeda_venda e local opcional. */
export function formatarPrecoVendaDoItem(item: ItemComPrecoVenda): string | null {
  return formatarPrecoVendaItem(item.preco_venda, item.moeda_venda, item.local?.tipo_regiao);
}
