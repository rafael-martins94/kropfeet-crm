import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { categoriasService } from "../services/categorias";
import { marcasService } from "../services/marcas";
import {
  readIntParam,
  useReplaceSearchParams,
  writeIntParam,
  writeParam,
} from "../utils/listUrlParams";
import { useAsync } from "./useAsync";
import { useDebounce } from "./useDebounce";

export function useModelosProdutoFiltros() {
  const [searchParams] = useSearchParams();
  const patchParams = useReplaceSearchParams();

  const page = readIntParam(searchParams, "page", 1);
  const searchFromUrl = searchParams.get("q") ?? "";
  const idMarca = searchParams.get("marca") ?? "";
  const idCategoria = searchParams.get("categoria") ?? "";

  const [search, setSearchState] = useState(searchFromUrl);
  const searchDebounced = useDebounce(search, 400);

  useEffect(() => {
    setSearchState(searchFromUrl);
  }, [searchFromUrl]);

  const marcas = useAsync(() => marcasService.listarTodas(), []);
  const categorias = useAsync(() => categoriasService.listarTodas(), []);

  const opcoesMarca = useMemo(
    () => [
      { value: "", label: "Todas as marcas" },
      ...(marcas.data ?? []).map((m) => ({ value: m.id, label: m.nome })),
    ],
    [marcas.data],
  );

  const opcoesCategoria = useMemo(
    () => [
      { value: "", label: "Todas as categorias" },
      ...(categorias.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categorias.data],
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

  const setIdMarca = (value: string) => {
    patchParams((next) => {
      writeParam(next, "marca", value || null);
      next.delete("page");
    });
  };

  const setIdCategoria = (value: string) => {
    patchParams((next) => {
      writeParam(next, "categoria", value || null);
      next.delete("page");
    });
  };

  const paramsListagem = useMemo(
    () => ({
      search: searchDebounced,
      idMarca: idMarca || undefined,
      idCategoria: idCategoria || undefined,
    }),
    [searchDebounced, idMarca, idCategoria],
  );

  return {
    page,
    setPage,
    search,
    setSearch,
    idMarca,
    setIdMarca,
    idCategoria,
    setIdCategoria,
    marcas,
    categorias,
    opcoesMarca,
    opcoesCategoria,
    resetPage,
    paramsListagem,
  };
}
