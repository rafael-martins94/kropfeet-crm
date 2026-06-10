import { supabase } from "../lib/supabase";
import type {
  CambioMoedaInsert,
  CambioMoedaUpdate,
  PaginationParams,
} from "../types/entities";
import { atualizar, deletar, inserir, listar, obterPorId } from "./base";

export const cambiosMoedaService = {
  listar: (params?: PaginationParams) =>
    listar("cambios_moeda", params, {
      defaultOrderBy: "data_cotacao",
      defaultAscending: false,
    }),
  obter: (id: string) => obterPorId("cambios_moeda", id),
  criar: (registro: CambioMoedaInsert) => inserir("cambios_moeda", registro),
  atualizar: (id: string, patch: CambioMoedaUpdate) =>
    atualizar("cambios_moeda", id, patch),
  deletar: (id: string) => deletar("cambios_moeda", id),

  /** Cotação mais recente até a data informada (inclusive). */
  buscarCotacaoNaData: async (
    moedaOrigem: string,
    moedaDestino: string,
    dataCompra: string,
  ) => {
    const origem = moedaOrigem.trim().toUpperCase();
    const destino = moedaDestino.trim().toUpperCase();

    const { data, error } = await supabase
      .from("cambios_moeda")
      .select("*")
      .eq("moeda_origem", origem)
      .eq("moeda_destino", destino)
      .lte("data_cotacao", dataCompra)
      .order("data_cotacao", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};
