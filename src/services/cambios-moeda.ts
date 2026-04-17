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
};
