import { useEffect, useMemo, useState } from "react";
import {
  FILTRO_CATEGORIA_SEM,
  FILTRO_LOCAL_SEM,
  idsLocaisPorRegiao,
  type RegiaoEstoqueFiltro,
} from "../services/itens-estoque";
import { categoriasService } from "../services/categorias";
import { locaisEstoqueService } from "../services/locais-estoque";
import { useAsync } from "./useAsync";
import { useDebounce } from "./useDebounce";
import type { StatusItem } from "../types/entities";
import type { DisplaySizeSystem } from "../utils/sizeConversion";

export function useItensEstoqueFiltros() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusItem[]>([]);
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [localEstoqueIds, setLocalEstoqueIds] = useState<string[]>([]);
  const [regiaoEstoque, setRegiaoEstoque] = useState<RegiaoEstoqueFiltro>("");
  const [displaySizeSystem, setDisplaySizeSystem] = useState<DisplaySizeSystem>("br");
  const [numeracaoFiltro, setNumeracaoFiltro] = useState("");

  const searchDebounced = useDebounce(search, 400);
  const numeracaoFiltroDebounced = useDebounce(numeracaoFiltro, 250);

  const categoriasLista = useAsync(() => categoriasService.listarTodas(), []);
  const locaisLista = useAsync(() => locaisEstoqueService.listarTodos(), []);

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

  const aplicarFiltroLocaisPorRegiao = (regiao: RegiaoEstoqueFiltro) => {
    if (regiao === "") {
      setLocalEstoqueIds([]);
      return;
    }
    setLocalEstoqueIds(idsLocaisPorRegiao(locaisLista.data ?? [], regiao));
  };

  useEffect(() => {
    if (regiaoEstoque === "" || !locaisLista.data) return;
    setLocalEstoqueIds(idsLocaisPorRegiao(locaisLista.data, regiaoEstoque));
  }, [locaisLista.data, regiaoEstoque]);

  const resetPage = () => setPage(1);

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
