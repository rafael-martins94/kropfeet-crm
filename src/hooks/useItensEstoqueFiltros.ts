import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FILTRO_CATEGORIA_SEM,
  FILTRO_LOCAL_SEM,
  idsLocaisPorRegiao,
  type RegiaoEstoqueFiltro,
} from "../services/itens-estoque";
import { categoriasService } from "../services/categorias";
import { locaisEstoqueService } from "../services/locais-estoque";
import type { StatusItem } from "../types/entities";
import {
  readCsvEnumParam,
  readCsvParam,
  readEnumParam,
  readIntParam,
  useReplaceSearchParams,
  writeCsvParam,
  writeEnumParam,
  writeIntParam,
  writeParam,
} from "../utils/listUrlParams";
import type { DisplaySizeSystem } from "../utils/sizeConversion";
import { useAsync } from "./useAsync";
import { useDebounce } from "./useDebounce";

const STATUS_ITENS: StatusItem[] = [
  "devolvido",
  "em_estoque",
  "em_processo_de_compra",
  "fora_de_estoque",
  "inativo",
  "reservado",
  "transferencia",
  "vendido",
];

const REGIOES_ESTOQUE = ["", "br", "eu"] as const satisfies readonly RegiaoEstoqueFiltro[];
const SISTEMAS_NUMERACAO = ["br", "eu", "us"] as const satisfies readonly DisplaySizeSystem[];

export function useItensEstoqueFiltros() {
  const [searchParams] = useSearchParams();
  const patchParams = useReplaceSearchParams();
  const searchParamsKey = searchParams.toString();

  const page = readIntParam(searchParams, "page", 1);
  const searchFromUrl = searchParams.get("q") ?? "";
  const regiaoEstoque = readEnumParam(searchParams, "regiao", REGIOES_ESTOQUE, "");
  const displaySizeSystem = readEnumParam(searchParams, "tam", SISTEMAS_NUMERACAO, "br");
  const numeracaoFromUrl = searchParams.get("num") ?? "";

  const status = useMemo(
    () => readCsvEnumParam(searchParams, "status", STATUS_ITENS),
    [searchParamsKey],
  );
  const categoriaIds = useMemo(
    () => readCsvParam(searchParams, "categoria"),
    [searchParamsKey],
  );

  const [search, setSearchState] = useState(searchFromUrl);
  const [numeracaoFiltro, setNumeracaoFiltroState] = useState(numeracaoFromUrl);

  useEffect(() => {
    setSearchState(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    setNumeracaoFiltroState(numeracaoFromUrl);
  }, [numeracaoFromUrl]);

  const searchDebounced = useDebounce(search, 400);
  const numeracaoFiltroDebounced = useDebounce(numeracaoFiltro, 250);

  const categoriasLista = useAsync(() => categoriasService.listarTodas(), []);
  const locaisLista = useAsync(() => locaisEstoqueService.listarTodos(), []);

  const localEstoqueIds = useMemo(() => {
    if (regiaoEstoque !== "" && locaisLista.data) {
      return idsLocaisPorRegiao(locaisLista.data, regiaoEstoque);
    }
    return readCsvParam(searchParams, "local");
  }, [searchParamsKey, regiaoEstoque, locaisLista.data]);

  const opcoesCategoriaFiltro = useMemo(
    () => [
      { value: "", label: "Todas as categorias" },
      { value: FILTRO_CATEGORIA_SEM, label: "Sem categoria" },
      ...(categoriasLista.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categoriasLista.data],
  );

  const opcoesLocalFiltro = useMemo(
    () => [
      { value: "", label: "Todos os locais" },
      { value: FILTRO_LOCAL_SEM, label: "Sem local definido" },
      ...(locaisLista.data ?? []).map((l) => ({ value: l.id, label: l.nome })),
    ],
    [locaisLista.data],
  );

  const opcoesLocalLinha = useMemo(
    () => [
      { value: "", label: "— Nenhum —" },
      ...(locaisLista.data ?? []).map((l) => ({ value: l.id, label: l.nome })),
    ],
    [locaisLista.data],
  );

  const resetPage = () => {
    patchParams((next) => {
      next.delete("page");
    });
  };

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

  const setStatus = (values: StatusItem[]) => {
    patchParams((next) => {
      writeCsvParam(next, "status", values);
      next.delete("page");
    });
  };

  const setCategoriaIds = (values: string[]) => {
    patchParams((next) => {
      writeCsvParam(next, "categoria", values);
      next.delete("page");
    });
  };

  const setLocalEstoqueIds = (values: string[]) => {
    patchParams((next) => {
      writeCsvParam(next, "local", values);
      next.delete("page");
    });
  };

  const setRegiaoEstoque = (regiao: RegiaoEstoqueFiltro) => {
    patchParams((next) => {
      writeEnumParam(next, "regiao", regiao, "");
      if (regiao === "") {
        writeCsvParam(next, "local", []);
      } else {
        next.delete("local");
      }
      next.delete("page");
    });
  };

  const aplicarFiltroLocaisPorRegiao = (regiao: RegiaoEstoqueFiltro) => {
    setRegiaoEstoque(regiao);
  };

  const setDisplaySizeSystem = (value: DisplaySizeSystem) => {
    patchParams((next) => {
      writeEnumParam(next, "tam", value, "br");
      next.delete("page");
    });
  };

  const setNumeracaoFiltro = (value: string) => {
    setNumeracaoFiltroState(value);
    patchParams((next) => {
      writeParam(next, "num", value.trim() || null);
      next.delete("page");
    });
  };

  const paramsListagem = useMemo(
    () => ({
      search: searchDebounced,
      status: status.length > 0 ? status : undefined,
      idCategoria: categoriaIds.length > 0 ? categoriaIds : undefined,
      idLocalEstoque: localEstoqueIds.length > 0 ? localEstoqueIds : undefined,
      regiaoEstoque,
      displaySizeSystem,
      numeracao: numeracaoFiltroDebounced,
    }),
    [
      searchDebounced,
      status,
      categoriaIds,
      localEstoqueIds,
      regiaoEstoque,
      displaySizeSystem,
      numeracaoFiltroDebounced,
    ],
  );

  return {
    page,
    setPage,
    search,
    setSearch,
    status,
    setStatus,
    categoriaIds,
    setCategoriaIds,
    localEstoqueIds,
    setLocalEstoqueIds,
    regiaoEstoque,
    setRegiaoEstoque,
    displaySizeSystem,
    setDisplaySizeSystem,
    numeracaoFiltro,
    setNumeracaoFiltro,
    searchDebounced,
    numeracaoFiltroDebounced,
    categoriasLista,
    locaisLista,
    opcoesCategoriaFiltro,
    opcoesLocalFiltro,
    opcoesLocalLinha,
    aplicarFiltroLocaisPorRegiao,
    resetPage,
    paramsListagem,
  };
}
