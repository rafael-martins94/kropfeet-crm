import { supabase } from "../lib/supabase";
import { urlImagemModelo } from "../utils/imagemModelo";
import type { DisplaySizeSystem } from "../utils/sizeConversion";

export type ItemCatalogoKropCafePublico = {
  id: string;
  sku: string;
  id_modelo_produto: string;
  preco_venda: number | null;
  moeda_venda: string | null;
  local?: { tipo_regiao?: string | null } | null;
};

type ImagemCatalogoRow = {
  id_modelo_produto: string;
  url_origem: string | null;
  caminho_arquivo: string | null;
};

export const catalogoKropCafeService = {
  buscar: async (params: {
    displaySizeSystem: DisplaySizeSystem;
    numeracao: string;
  }): Promise<ItemCatalogoKropCafePublico[]> => {
    const numeracao = params.numeracao.trim();
    if (!numeracao) return [];

    const { data, error } = await supabase.rpc("catalogo_kropcafe_buscar", {
      p_display_system: params.displaySizeSystem,
      p_numeracao: numeracao,
    });

    if (error) throw error;

    return ((data ?? []) as Array<{
      id: string;
      sku: string;
      id_modelo_produto: string;
      preco_venda: number | null;
      moeda_venda: string | null;
      tipo_regiao_local: string | null;
    }>).map((row) => ({
      id: row.id,
      sku: row.sku,
      id_modelo_produto: row.id_modelo_produto,
      preco_venda: row.preco_venda,
      moeda_venda: row.moeda_venda,
      local: row.tipo_regiao_local ? { tipo_regiao: row.tipo_regiao_local } : null,
    }));
  },

  listarGaleriaUrlsPorModelos: async (idsModelo: string[]): Promise<Record<string, string[]>> => {
    const ids = [...new Set(idsModelo)].filter(Boolean).slice(0, 80);
    if (ids.length === 0) return {};

    const { data, error } = await supabase.rpc("catalogo_kropcafe_fotos", {
      p_modelo_ids: ids,
    });

    if (error) throw error;

    const map: Record<string, string[]> = {};
    for (const row of (data ?? []) as ImagemCatalogoRow[]) {
      const url = urlImagemModelo(row);
      if (!url) continue;
      if (!map[row.id_modelo_produto]) map[row.id_modelo_produto] = [];
      map[row.id_modelo_produto].push(url);
    }
    return map;
  },
};
