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

export type ItemCarrinhoCatalogoSalvo = {
  id: string;
  sku: string;
  id_modelo_produto: string;
  preco_venda: number | null;
  moeda_venda: string | null;
  numeracao: string;
};

export type CarrinhoCatalogoSalvo = {
  id: string;
  criado_em: string;
  nome: string;
  telefone: string;
  email: string | null;
  pais: string | null;
  observacao: string | null;
  itens: ItemCarrinhoCatalogoSalvo[];
};

export type ClienteCatalogoRecuperado = {
  nome: string;
  telefone: string;
  email: string | null;
  pais: string | null;
  observacao: string | null;
};

export type LocalEstoqueCatalogo = {
  id: string;
  nome: string;
  pais: string | null;
  tipo_regiao: string | null;
};

export type CategoriaEstoqueCatalogo = {
  id: string;
  nome: string;
};

export type ItemEstoqueCatalogo = {
  id: string;
  sku: string;
  id_modelo_produto: string;
  nome_produto: string;
  preco_venda: number | null;
  moeda_venda: string | null;
  numeracao_br: number | null;
  numeracao_eu: number | null;
  numeracao_us: string | null;
  id_local_estoque: string | null;
  local_nome: string | null;
  local_pais: string | null;
  local_tipo_regiao: string | null;
  id_categoria: string | null;
  categoria_nome: string | null;
};

export type EstoqueCatalogo = {
  locais: LocalEstoqueCatalogo[];
  categorias: CategoriaEstoqueCatalogo[];
  itens: ItemEstoqueCatalogo[];
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() && Number.isFinite(Number(valor))) return Number(valor);
  return null;
}

function listaObjetos(valor: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

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

  listarCarrinhosSalvos: async (): Promise<CarrinhoCatalogoSalvo[]> => {
    const { data, error } = await supabase.rpc("catalogo_kropcafe_listar_carrinhos");
    if (error) throw error;
    if (!Array.isArray(data)) return [];
    return data.flatMap((linha) => {
      if (!linha || typeof linha !== "object" || Array.isArray(linha)) return [];
      const row = linha as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      if (!id) return [];
      const itens = Array.isArray(row.itens)
        ? row.itens.flatMap((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return [];
            const par = item as Record<string, unknown>;
            const itemId = typeof par.id === "string" ? par.id : "";
            const modelo = typeof par.id_modelo_produto === "string" ? par.id_modelo_produto : "";
            if (!itemId || !modelo) return [];
            return [{
              id: itemId,
              sku: typeof par.sku === "string" ? par.sku : "",
              id_modelo_produto: modelo,
              preco_venda: typeof par.preco_venda === "number" ? par.preco_venda : null,
              moeda_venda: typeof par.moeda_venda === "string" ? par.moeda_venda : null,
              numeracao: typeof par.numeracao === "string" ? par.numeracao : "",
            }];
          })
        : [];
      const textoOuNulo = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);
      return [{
        id,
        criado_em: typeof row.criado_em === "string" ? row.criado_em : "",
        nome: typeof row.nome === "string" ? row.nome : "",
        telefone: typeof row.telefone === "string" ? row.telefone : "",
        email: textoOuNulo(row.email),
        pais: textoOuNulo(row.pais),
        observacao: textoOuNulo(row.observacao),
        itens,
      }];
    });
  },

  listarEstoque: async (): Promise<EstoqueCatalogo> => {
    const { data, error } = await supabase.rpc("catalogo_kropcafe_listar_estoque");
    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { locais: [], categorias: [], itens: [] };
    }
    const corpo = data as Record<string, unknown>;
    return {
      locais: listaObjetos(corpo.locais).flatMap((row) => {
        const id = texto(row.id);
        const nome = texto(row.nome);
        if (!id || !nome) return [];
        return [{
          id,
          nome,
          pais: texto(row.pais) || null,
          tipo_regiao: texto(row.tipo_regiao) || null,
        }];
      }),
      categorias: listaObjetos(corpo.categorias).flatMap((row) => {
        const id = texto(row.id);
        const nome = texto(row.nome);
        if (!id || !nome) return [];
        return [{ id, nome }];
      }),
      itens: listaObjetos(corpo.itens).flatMap((row) => {
        const id = texto(row.id);
        if (!id) return [];
        return [{
          id,
          sku: texto(row.sku),
          id_modelo_produto: texto(row.id_modelo_produto),
          nome_produto: texto(row.nome_produto),
          preco_venda: numero(row.preco_venda),
          moeda_venda: texto(row.moeda_venda) || null,
          numeracao_br: numero(row.numeracao_br),
          numeracao_eu: numero(row.numeracao_eu),
          numeracao_us: texto(row.numeracao_us) || null,
          id_local_estoque: texto(row.id_local_estoque) || null,
          local_nome: texto(row.local_nome) || null,
          local_pais: texto(row.local_pais) || null,
          local_tipo_regiao: texto(row.local_tipo_regiao) || null,
          id_categoria: texto(row.id_categoria) || null,
          categoria_nome: texto(row.categoria_nome) || null,
        }];
      }),
    };
  },

  listarVendedores: async (): Promise<Array<{ id: string; nome: string }>> => {
    const { data, error } = await supabase.rpc("catalogo_kropcafe_listar_vendedores");
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; nome: string }>;
  },

  salvarSelecao: async (params: {
    nome: string;
    telefone: string;
    email: string | null;
    pais: string | null;
    observacao: string | null;
    gerarOrdem: boolean;
    vendedor: string | null;
    itens: Array<{ id: string; sku: string; numeracao: string; preco: string | null }>;
  }): Promise<{ id_cliente: string; id_venda: string | null; numero: string | null }> => {
    const { data, error } = await supabase.rpc("catalogo_kropcafe_salvar_selecao", {
      p_nome: params.nome,
      p_telefone: params.telefone,
      p_email: params.email,
      p_pais: params.pais,
      p_observacao: params.observacao,
      p_itens: params.itens,
      p_gerar_ordem: params.gerarOrdem,
      p_vendedor: params.vendedor,
    });

    if (error) throw error;
    const resultado = data as {
      id_cliente?: string;
      id_venda?: string | null;
      numero?: string | null;
    } | null;
    if (!resultado?.id_cliente) {
      throw new Error("Não foi possível salvar a seleção.");
    }
    return {
      id_cliente: resultado.id_cliente,
      id_venda: resultado.id_venda ?? null,
      numero: resultado.numero ?? null,
    };
  },
};
