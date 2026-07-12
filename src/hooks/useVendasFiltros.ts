import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { StatusVenda } from "../types/entities";
import {
  readEnumParam,
  readIntParam,
  useReplaceSearchParams,
  writeEnumParam,
  writeIntParam,
  writeParam,
} from "../utils/listUrlParams";
import { useDebounce } from "./useDebounce";

export const COLUNAS_ORDEM_VENDA = [
  "data_pedido",
  "numero",
  "nome_cliente",
  "valor_total",
  "status_venda",
] as const;

export type ColunaOrdemVenda = (typeof COLUNAS_ORDEM_VENDA)[number];

const STATUS_VENDA = [
  "em_aberto",
  "pago",
  "preparando_envio",
  "enviado",
  "finalizado",
  "cancelado",
] as const satisfies readonly StatusVenda[];

const COLUNA_PADRAO: ColunaOrdemVenda = "data_pedido";

/** Colunas cujo default ao ativar é descendente (data, total). */
const COLUNAS_DEFAULT_DESC = new Set<ColunaOrdemVenda>(["data_pedido", "valor_total"]);

export function useVendasFiltros() {
  const [searchParams] = useSearchParams();
  const patchParams = useReplaceSearchParams();

  const page = readIntParam(searchParams, "page", 1);
  const statusRaw = searchParams.get("status") ?? "";
  const status = (STATUS_VENDA as readonly string[]).includes(statusRaw)
    ? (statusRaw as StatusVenda)
    : ("" as const);

  const searchFromUrl = searchParams.get("q") ?? "";
  const skuFromUrl = searchParams.get("sku") ?? "";
  const marcadorFromUrl = searchParams.get("tag") ?? "";

  const colunaOrdem = readEnumParam(
    searchParams,
    "ordem",
    COLUNAS_ORDEM_VENDA,
    COLUNA_PADRAO,
  );
  const dirParam = searchParams.get("dir");
  const ordemAscendente =
    dirParam === "asc"
      ? true
      : dirParam === "desc"
        ? false
        : !COLUNAS_DEFAULT_DESC.has(colunaOrdem);

  const [search, setSearchState] = useState(searchFromUrl);
  const [sku, setSkuState] = useState(skuFromUrl);
  const [marcador, setMarcadorState] = useState(marcadorFromUrl);

  useEffect(() => {
    setSearchState(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    setSkuState(skuFromUrl);
  }, [skuFromUrl]);

  useEffect(() => {
    setMarcadorState(marcadorFromUrl);
  }, [marcadorFromUrl]);

  const searchDebounced = useDebounce(search, 350);
  const skuDebounced = useDebounce(sku, 350);
  const marcadorDebounced = useDebounce(marcador, 350);

  const setPage = (p: number) => {
    patchParams((next) => {
      writeIntParam(next, "page", p);
    });
  };

  const setSearch = (value: string) => {
    setSearchState(value);
    patchParams((next) => {
      writeParam(next, "q", value.trim() || null);
      next.delete("page");
    });
  };

  const setSku = (value: string) => {
    setSkuState(value);
    patchParams((next) => {
      writeParam(next, "sku", value.trim() || null);
      next.delete("page");
    });
  };

  const setMarcador = (value: string) => {
    setMarcadorState(value);
    patchParams((next) => {
      writeParam(next, "tag", value.trim() || null);
      next.delete("page");
    });
  };

  const setStatus = (value: StatusVenda | "") => {
    patchParams((next) => {
      writeParam(next, "status", value || null);
      next.delete("page");
    });
  };

  const setOrdenacao = (coluna: ColunaOrdemVenda, ascendente: boolean) => {
    patchParams((next) => {
      writeEnumParam(next, "ordem", coluna, COLUNA_PADRAO);
      if (coluna === COLUNA_PADRAO && !ascendente) {
        next.delete("dir");
      } else {
        writeParam(next, "dir", ascendente ? "asc" : "desc");
      }
      next.delete("page");
    });
  };

  const alterarOrdem = (coluna: ColunaOrdemVenda) => {
    if (coluna === colunaOrdem) {
      setOrdenacao(coluna, !ordemAscendente);
    } else {
      setOrdenacao(coluna, !COLUNAS_DEFAULT_DESC.has(coluna));
    }
  };

  return {
    page,
    setPage,
    search,
    setSearch,
    searchDebounced,
    sku,
    setSku,
    skuDebounced,
    marcador,
    setMarcador,
    marcadorDebounced,
    status,
    setStatus,
    colunaOrdem,
    ordemAscendente,
    alterarOrdem,
  };
}
