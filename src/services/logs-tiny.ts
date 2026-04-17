import type { PaginationParams } from "../types/entities";
import { listar } from "./base";

export const logsTinyService = {
  listar: (params?: PaginationParams) =>
    listar("logs_sincronizacao_tiny", params, {
      defaultOrderBy: "iniciado_em",
      defaultAscending: false,
    }),
};
