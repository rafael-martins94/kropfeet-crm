import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { categoriasService } from "../services/categorias";
import { marcasService } from "../services/marcas";
import {
  COLUNAS_ORDEM_VITRINE,
  type ColunaOrdemVitrine,
  FILTRO_CATEGORIA_SEM,
} from "../services/itens-estoque";
import { vitrinesService } from "../services/vitrines";
import {
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

const SISTEMAS_NUMERACAO = ["br", "eu", "us"] as const satisfies readonly DisplaySizeSystem[];
const DIRECOES = ["asc", "desc"] as const;

export function useVitrineSelecaoFiltros() {
  const [searchParams] = useSearchParams();
  const patchParams = useReplaceSearchParams();
  const searchParamsKey = searchParams.toString();

  const page = readIntParam(searchParams, "page", 1);
  const searchFromUrl = searchParams.get("q") ?? "";
  const numeracaoFromUrl = searchParams.get("num") ?? "";
  const disponiveisFromUrl = searchParams.get("disp") ?? searchParams.get("dispMin") ?? "";
  const displaySizeSystem = readEnumParam(searchParams, "tam", SISTEMAS_NUMERACAO, "br");
  const colunaOrdem = readEnumParam(
    searchParams,
    "ordem",
    COLUNAS_ORDEM_VITRINE,
    "atualizado_em" as ColunaOrdemVitrine,
  );
  const direcao = readEnumParam(searchParams, "dir", DIRECOES, colunaOrdem === "atualizado_em" ? "desc" : "asc");
  const somenteSelecionados = searchParams.get("sel") === "1";
  const categoriaIds = useMemo(() => readCsvParam(searchParams, "categoria"), [searchParamsKey]);
  const marcaIds = useMemo(() => readCsvParam(searchParams, "marca"), [searchParamsKey]);
  const locaisSelecionadosUrl = useMemo(() => readCsvParam(searchParams, "local"), [searchParamsKey]);

  const [search, setSearchState] = useState(searchFromUrl);
  const [numeracaoFiltro, setNumeracaoFiltroState] = useState(numeracaoFromUrl);
  const [disponiveisFiltro, setDisponiveisFiltroState] = useState(disponiveisFromUrl);
  const searchDebounced = useDebounce(search, 400);
  const numeracaoFiltroDebounced = useDebounce(numeracaoFiltro, 250);
  const disponiveisDebounced = useDebounce(disponiveisFiltro, 250);

  useEffect(() => setSearchState(searchFromUrl), [searchFromUrl]);
  useEffect(() => setNumeracaoFiltroState(numeracaoFromUrl), [numeracaoFromUrl]);
  useEffect(() => setDisponiveisFiltroState(disponiveisFromUrl), [disponiveisFromUrl]);

  const locaisEuropa = useAsync(() => vitrinesService.listarLocaisEuropaOrigem(), []);
  const categorias = useAsync(() => categoriasService.listarTodas(), []);
  const marcas = useAsync(() => marcasService.listarTodas(), []);

  const idsLocaisEuropa = useMemo(
    () => (locaisEuropa.data ?? []).map((local) => local.id),
    [locaisEuropa.data],
  );

  const localEstoqueFiltroIds = useMemo(
    () => locaisSelecionadosUrl.filter((id) => idsLocaisEuropa.includes(id)),
    [idsLocaisEuropa, locaisSelecionadosUrl],
  );

  const localEstoqueIds = useMemo(() => {
    if (idsLocaisEuropa.length === 0) return [];
    return localEstoqueFiltroIds.length > 0 ? localEstoqueFiltroIds : idsLocaisEuropa;
  }, [idsLocaisEuropa, localEstoqueFiltroIds]);

  const opcoesLocalFiltro = useMemo(
    () => [
      { value: "", label: "Todos os locais europeus" },
      ...(locaisEuropa.data ?? []).map((local) => ({ value: local.id, label: local.nome })),
    ],
    [locaisEuropa.data],
  );

  const opcoesCategoriaFiltro = useMemo(
    () => [
      { value: "", label: "Todas as categorias" },
      { value: FILTRO_CATEGORIA_SEM, label: "Sem categoria" },
      ...(categorias.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categorias.data],
  );

  const opcoesMarcaFiltro = useMemo(
    () => [
      { value: "", label: "Todas as marcas" },
      ...(marcas.data ?? []).map((m) => ({ value: m.id, label: m.nome })),
    ],
    [marcas.data],
  );

  const resetPage = () => {
    patchParams((next) => next.delete("page"));
  };

  const setPage = (p: number) => {
    patchParams((next) => writeIntParam(next, "page", p));
  };

  const setSearch = (value: string) => {
    setSearchState(value);
    patchParams((next) => {
      writeParam(next, "q", value.trim() || null);
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

  const setDisponiveisFiltro = (value: string) => {
    setDisponiveisFiltroState(value);
    patchParams((next) => {
      writeParam(next, "disp", value.trim() || null);
      next.delete("dispMin");
      next.delete("page");
    });
  };

  const setLocalEstoqueIds = (values: string[]) => {
    const validos = values.filter((id) => idsLocaisEuropa.includes(id));
    patchParams((next) => {
      writeCsvParam(next, "local", validos.length === idsLocaisEuropa.length ? [] : validos);
      next.delete("page");
    });
  };

  const setCategoriaIds = (values: string[]) => {
    patchParams((next) => {
      writeCsvParam(next, "categoria", values);
      next.delete("page");
    });
  };

  const setMarcaIds = (values: string[]) => {
    patchParams((next) => {
      writeCsvParam(next, "marca", values);
      next.delete("page");
    });
  };

  const setDisplaySizeSystem = (value: DisplaySizeSystem) => {
    patchParams((next) => {
      writeEnumParam(next, "tam", value, "br");
      next.delete("page");
    });
  };

  const setOrdem = (coluna: ColunaOrdemVitrine) => {
    patchParams((next) => {
      const ativa = coluna === colunaOrdem;
      const novaDir = ativa ? (direcao === "asc" ? "desc" : "asc") : coluna === "atualizado_em" ? "desc" : "asc";
      writeEnumParam(next, "ordem", coluna, "atualizado_em");
      writeEnumParam(next, "dir", novaDir, coluna === "atualizado_em" ? "desc" : "asc");
      next.delete("page");
    });
  };

  const setSomenteSelecionados = (value: boolean) => {
    patchParams((next) => {
      writeParam(next, "sel", value ? "1" : null);
      next.delete("page");
    });
  };

  const limparFiltros = () => {
    setSearchState("");
    setNumeracaoFiltroState("");
    setDisponiveisFiltroState("");
    patchParams((next) => {
      next.delete("q");
      next.delete("num");
      next.delete("disp");
      next.delete("dispMin");
      next.delete("local");
      next.delete("marca");
      next.delete("categoria");
      next.delete("page");
      next.delete("ordem");
      next.delete("dir");
      next.delete("sel");
      writeEnumParam(next, "tam", "br", "br");
    });
  };

  const disponiveisExatos = useMemo(() => {
    const trimmed = disponiveisDebounced.trim();
    if (!trimmed) return undefined;
    const valor = Number(trimmed);
    return Number.isFinite(valor) && valor >= 0 ? valor : undefined;
  }, [disponiveisDebounced]);

  const paramsListagem = useMemo(
    () => ({
      idsLocaisEuropa: localEstoqueIds,
      idsLocaisContagem: idsLocaisEuropa,
      idCategoria: categoriaIds.length > 0 ? categoriaIds : undefined,
      idMarca: marcaIds.length > 0 ? marcaIds : undefined,
      search: searchDebounced,
      numeracao: numeracaoFiltroDebounced,
      disponiveisExatos,
      displaySizeSystem,
      ordenacao: { coluna: colunaOrdem, ascendente: direcao === "asc" },
    }),
    [
      localEstoqueIds,
      idsLocaisEuropa,
      categoriaIds,
      marcaIds,
      searchDebounced,
      numeracaoFiltroDebounced,
      disponiveisExatos,
      displaySizeSystem,
      colunaOrdem,
      direcao,
    ],
  );

  return {
    page,
    setPage,
    search,
    setSearch,
    numeracaoFiltro,
    setNumeracaoFiltro,
    disponiveisFiltro,
    setDisponiveisFiltro,
    displaySizeSystem,
    setDisplaySizeSystem,
    colunaOrdem,
    direcao,
    setOrdem,
    somenteSelecionados,
    setSomenteSelecionados,
    limparFiltros,
    localEstoqueFiltroIds,
    localEstoqueIds,
    idsLocaisContagem: idsLocaisEuropa,
    setLocalEstoqueIds,
    categoriaIds,
    setCategoriaIds,
    marcaIds,
    setMarcaIds,
    locaisEuropa,
    categorias,
    marcas,
    opcoesLocalFiltro,
    opcoesCategoriaFiltro,
    opcoesMarcaFiltro,
    resetPage,
    paramsListagem,
  };
}
