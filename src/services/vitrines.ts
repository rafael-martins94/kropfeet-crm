import { supabase } from "../lib/supabase";
import type { Json } from "../types/database";
import type {
  EtapaVitrine,
  ItemEstoque,
  LocalEstoque,
  PaginatedResult,
  PaginationParams,
  StatusItem,
  StatusVitrine,
  Vitrine,
  VitrineDestinoSaida,
  VitrineItem,
  VitrineItemUpdate,
} from "../types/entities";
import { idsLocaisPorRegiao } from "./itens-estoque";
import { locaisEstoqueService } from "./locais-estoque";
import { resolverMoedaVendaItem } from "../utils/moedaItemEstoque";

const sb = supabase as unknown as {
  from: (table: string) => any;
};

export interface VitrineItemSnapshot {
  id_item_estoque: string;
  sku: string;
  nome_produto: string;
  nome_exibicao: string;
  foto_url: string | null;
  id_modelo_produto: string;
  nome_modelo: string | null;
  marca: string | null;
  categoria: string | null;
  numeracao_br: number | null;
  numeracao_eu: number | null;
  numeracao_us: string | null;
  sistema_numeracao?: string | null;
  preco: number | null;
  moeda: string | null;
  correspondencias: VitrineCorrespondenciaSnapshot[];
  item_unico: boolean;
}

export interface VitrineCorrespondenciaSnapshot {
  id_item_estoque?: string;
  sku: string;
  numeracao_br: number | null;
  numeracao_eu: number | null;
  numeracao_us: string | null;
  sistema_numeracao?: string | null;
  preco: number | null;
  moeda: string | null;
  estoque?: string | null;
  local_nome: string | null;
  status_item: StatusItem | string;
}

export interface VitrineItemDetalhado extends Omit<VitrineItem, "snapshot"> {
  item?: (ItemEstoque & {
    modelo?: {
      id: string;
      nome_modelo: string;
      slug: string;
      id_categoria?: string | null;
      id_marca?: string | null;
      marca?: { id: string; nome: string } | null;
      categoria?: { id: string; nome: string } | null;
    } | null;
    local?: {
      id: string;
      nome: string;
      codigo: string;
      pais?: string | null;
      tipo_regiao?: string | null;
    } | null;
  }) | null;
  snapshot: VitrineItemSnapshot | null;
}

export interface VitrineDestinoDetalhado extends VitrineDestinoSaida {
  item?: VitrineItemDetalhado["item"];
  local_destino?: LocalEstoque | null;
}

export interface VitrineResumo extends Vitrine {
  nomeUsuario?: string | null;
  totalItens?: number;
}

export interface VitrineComItens extends VitrineResumo {
  itens: VitrineItemDetalhado[];
  destinos: VitrineDestinoDetalhado[];
}

export interface ValidacaoItemVitrine {
  id_item: string;
  valido: boolean;
  motivo: string | null;
}

const SELECT_ITEM_DETALHADO = `
  *,
  item:itens_estoque(
    *,
    modelo:modelos_produto(
      id,
      nome_modelo,
      slug,
      id_categoria,
      id_marca,
      marca:marcas(id, nome),
      categoria:categorias(id, nome)
    ),
    local:locais_estoque(id, nome, codigo, pais, tipo_regiao)
  )
`;

const SELECT_DESTINO_DETALHADO = `
  *,
  item:itens_estoque(
    *,
    modelo:modelos_produto(
      id,
      nome_modelo,
      slug,
      id_categoria,
      id_marca,
      marca:marcas(id, nome),
      categoria:categorias(id, nome)
    ),
    local:locais_estoque(id, nome, codigo, pais, tipo_regiao)
  ),
  local_destino:locais_estoque(*)
`;

function tituloPadraoVitrine(data = new Date()): string {
  return `Vitrine — ${new Intl.DateTimeFormat("pt-BR").format(data)}`;
}

function asSnapshot(valor: Json | null): VitrineItemSnapshot | null {
  return (valor ?? null) as VitrineItemSnapshot | null;
}

function normalizarItens(rows: unknown[]): VitrineItemDetalhado[] {
  return (rows as VitrineItemDetalhado[]).map((row) => ({
    ...row,
    snapshot: asSnapshot(row.snapshot as Json | null),
  }));
}

async function nomesUsuarios(ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return new Map();

  const { data, error } = await sb
    .from("perfis_usuario")
    .select("id, nome")
    .in("id", unicos);
  if (error) throw error;

  return new Map((data ?? []).map((row: { id: string; nome: string }) => [row.id, row.nome]));
}

export const vitrinesService = {
  tituloPadrao: tituloPadraoVitrine,

  resolverLocalVitrine: async (): Promise<string | null> => {
    const { data, error } = await supabase.rpc("vitrines_id_local_vitrine");
    if (error) throw error;
    return data ?? null;
  },

  listarLocaisEuropaOrigem: async (): Promise<LocalEstoque[]> => {
    const locais = await locaisEstoqueService.listarTodos();
    const idsEuropa = new Set(idsLocaisPorRegiao(locais, "eu"));
    return locais.filter((local) => idsEuropa.has(local.id) && local.ativo);
  },

  obterRascunho: async (): Promise<Vitrine | null> => {
    const { data, error } = await supabase
      .from("vitrines")
      .select("*")
      .eq("status", "rascunho")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  criarOuContinuarRascunho: async (idUsuario: string, titulo?: string): Promise<Vitrine> => {
    const existente = await vitrinesService.obterRascunho();
    if (existente) return existente;

    const { data, error } = await supabase
      .from("vitrines")
      .insert({
        id_usuario: idUsuario,
        titulo: titulo?.trim() || tituloPadraoVitrine(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  obter: async (id: string): Promise<Vitrine | null> => {
    const { data, error } = await supabase.from("vitrines").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ?? null;
  },

  obterAtual: async (): Promise<VitrineResumo | null> => {
    const { data, error } = await supabase
      .from("vitrines")
      .select("*")
      .eq("status", "publicada")
      .order("publicado_em", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const nomes = await nomesUsuarios([data.id_usuario]);
    return { ...data, nomeUsuario: nomes.get(data.id_usuario) ?? null };
  },

  listar: async (
    params?: PaginationParams & { status?: StatusVitrine | StatusVitrine[] | "" },
  ): Promise<PaginatedResult<VitrineResumo>> => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const termo = params?.search?.trim();

    let query = supabase
      .from("vitrines")
      .select("*", { count: "exact" })
      .order("criado_em", { ascending: false });

    const statusFiltro = params?.status;
    if (Array.isArray(statusFiltro) && statusFiltro.length > 0) {
      query = query.in("status", statusFiltro);
    } else if (statusFiltro && !Array.isArray(statusFiltro)) {
      query = query.eq("status", statusFiltro);
    }

    if (termo) {
      query = query.ilike("titulo", `%${termo.replace(/%/g, "")}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const vitrines = data ?? [];
    const ids = vitrines.map((v) => v.id);
    const idsUsuarios = vitrines.map((v) => v.id_usuario);

    const [nomes, contagens] = await Promise.all([
      nomesUsuarios(idsUsuarios),
      vitrinesService.contarItensPorVitrine(ids),
    ]);

    return {
      data: vitrines.map((v) => ({
        ...v,
        nomeUsuario: nomes.get(v.id_usuario) ?? null,
        totalItens: contagens.get(v.id) ?? 0,
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  contarItensPorVitrine: async (idsVitrines: string[]): Promise<Map<string, number>> => {
    if (idsVitrines.length === 0) return new Map();
    const { data, error } = await supabase
      .from("vitrine_itens")
      .select("id_vitrine")
      .in("id_vitrine", idsVitrines);
    if (error) throw error;

    const map = new Map<string, number>();
    for (const row of data ?? []) {
      map.set(row.id_vitrine, (map.get(row.id_vitrine) ?? 0) + 1);
    }
    return map;
  },

  listarItens: async (idVitrine: string): Promise<VitrineItemDetalhado[]> => {
    const { data, error } = await supabase
      .from("vitrine_itens")
      .select(SELECT_ITEM_DETALHADO)
      .eq("id_vitrine", idVitrine)
      .order("numero_caixa", { ascending: true, nullsFirst: false })
      .order("ordem_selecao", { ascending: true });
    if (error) throw error;
    return normalizarItens(data ?? []);
  },

  listarDestinos: async (idVitrine: string): Promise<VitrineDestinoDetalhado[]> => {
    const { data, error } = await supabase
      .from("vitrine_destinos_saida")
      .select(SELECT_DESTINO_DETALHADO)
      .eq("id_vitrine", idVitrine);
    if (error) throw error;
    return (data ?? []) as unknown as VitrineDestinoDetalhado[];
  },

  obterComItens: async (id: string): Promise<VitrineComItens | null> => {
    const vitrine = await vitrinesService.obter(id);
    if (!vitrine) return null;
    const [itens, destinos, nomes, contagens] = await Promise.all([
      vitrinesService.listarItens(id),
      vitrinesService.listarDestinos(id),
      nomesUsuarios([vitrine.id_usuario]),
      vitrinesService.contarItensPorVitrine([id]),
    ]);
    return {
      ...vitrine,
      nomeUsuario: nomes.get(vitrine.id_usuario) ?? null,
      totalItens: contagens.get(id) ?? 0,
      itens,
      destinos,
    };
  },

  obterAtualComItens: async (): Promise<VitrineComItens | null> => {
    const atual = await vitrinesService.obterAtual();
    return atual ? vitrinesService.obterComItens(atual.id) : null;
  },

  adicionarItem: async (idVitrine: string, idItemEstoque: string): Promise<VitrineItem> => {
    const itens = await vitrinesService.listarItens(idVitrine);
    const proximaOrdem = itens.reduce((max, item) => Math.max(max, item.ordem_selecao), 0) + 1;
    const { data, error } = await supabase
      .from("vitrine_itens")
      .insert({
        id_vitrine: idVitrine,
        id_item_estoque: idItemEstoque,
        ordem_selecao: proximaOrdem,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  removerItem: async (idVitrine: string, idItemEstoque: string): Promise<void> => {
    const { error } = await supabase
      .from("vitrine_itens")
      .delete()
      .eq("id_vitrine", idVitrine)
      .eq("id_item_estoque", idItemEstoque);
    if (error) throw error;
  },

  removerItens: async (idVitrine: string, idsItensEstoque: string[]): Promise<void> => {
    const ids = [...new Set(idsItensEstoque)].filter(Boolean);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("vitrine_itens")
      .delete()
      .eq("id_vitrine", idVitrine)
      .in("id_item_estoque", ids);
    if (error) throw error;
  },

  atualizarItem: async (idVitrineItem: string, patch: VitrineItemUpdate): Promise<VitrineItem> => {
    const { data, error } = await supabase
      .from("vitrine_itens")
      .update(patch)
      .eq("id", idVitrineItem)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  salvarPosicoes: async (
    idVitrine: string,
    posicoes: Array<{ id_item_estoque: string; numero_caixa: number | null }>,
  ): Promise<void> => {
    const itens = await vitrinesService.listarItens(idVitrine);
    const porItem = new Map(itens.map((item) => [item.id_item_estoque, item]));
    const idsAfetados = posicoes
      .map((posicao) => porItem.get(posicao.id_item_estoque)?.id)
      .filter((id): id is string => Boolean(id));

    if (idsAfetados.length > 0) {
      const { error } = await supabase
        .from("vitrine_itens")
        .update({ numero_caixa: null })
        .in("id", idsAfetados);
      if (error) throw error;
    }

    for (const posicao of posicoes.filter((p) => p.numero_caixa != null)) {
      const item = porItem.get(posicao.id_item_estoque);
      if (!item) continue;
      await vitrinesService.atualizarItem(item.id, { numero_caixa: posicao.numero_caixa });
    }
  },

  atualizarEtapa: async (idVitrine: string, etapa: EtapaVitrine): Promise<void> => {
    const { error } = await supabase.from("vitrines").update({ etapa }).eq("id", idVitrine);
    if (error) throw error;
  },

  atualizarTitulo: async (idVitrine: string, titulo: string): Promise<void> => {
    const tituloLimpo = titulo.trim();
    if (!tituloLimpo) {
      throw new Error("O nome da vitrine não pode ficar vazio.");
    }
    const { error } = await supabase.from("vitrines").update({ titulo: tituloLimpo }).eq("id", idVitrine);
    if (error) throw error;
  },

  atualizarEstadoUi: async (idVitrine: string, estadoUi: Json): Promise<void> => {
    const { error } = await supabase
      .from("vitrines")
      .update({ estado_ui: estadoUi })
      .eq("id", idVitrine);
    if (error) throw error;
  },

  salvarDestino: async (
    idVitrine: string,
    idItemEstoque: string,
    idLocalDestino: string,
  ): Promise<void> => {
    const { error } = await supabase
      .from("vitrine_destinos_saida")
      .upsert(
        {
          id_vitrine: idVitrine,
          id_item_estoque: idItemEstoque,
          id_local_destino: idLocalDestino,
        },
        { onConflict: "id_vitrine,id_item_estoque" },
      );
    if (error) throw error;
  },

  aplicarDestinoEmLote: async (
    idVitrine: string,
    idsItensEstoque: string[],
    idLocalDestino: string,
  ): Promise<void> => {
    for (const idItemEstoque of idsItensEstoque) {
      await vitrinesService.salvarDestino(idVitrine, idItemEstoque, idLocalDestino);
    }
  },

  validarItens: async (idsItens: string[]): Promise<ValidacaoItemVitrine[]> => {
    if (idsItens.length === 0) return [];
    const { data, error } = await supabase.rpc("validar_itens_vitrine", { p_ids: idsItens });
    if (error) throw error;
    return data ?? [];
  },

  publicar: async (idVitrine: string, idUsuario: string): Promise<void> => {
    const { error } = await supabase.rpc("publicar_vitrine", {
      p_id_vitrine: idVitrine,
      p_id_usuario: idUsuario,
    });
    if (error) throw error;
  },

  buscarCorrespondencias: async (
    idItemExposto: string,
    idModeloProduto: string,
    idsSelecionados: string[] = [],
  ): Promise<VitrineCorrespondenciaSnapshot[]> => {
    const idLocalVitrine = await vitrinesService.resolverLocalVitrine();
    let query = supabase
      .from("itens_estoque")
      .select("id, sku, numeracao_br, numeracao_eu, numeracao_us, sistema_numeracao, status_item, preco_venda, moeda_venda, local:locais_estoque(nome, tipo_regiao, ativo)")
      .eq("id_modelo_produto", idModeloProduto)
      .eq("status_item", "em_estoque")
      .neq("id", idItemExposto);

    const idsExcluir = [...new Set([idItemExposto, ...idsSelecionados])].filter(Boolean);
    if (idsExcluir.length > 0) {
      query = query.not("id", "in", `(${idsExcluir.join(",")})`);
    }
    if (idLocalVitrine) {
      query = query.neq("id_local_estoque", idLocalVitrine);
    }

    const { data, error } = await query.order("numeracao_br", {
      ascending: true,
      nullsFirst: false,
    });
    if (error) throw error;

    const mapped = ((data ?? []) as unknown as Array<{
      id: string;
      sku: string;
      numeracao_br: number | null;
      numeracao_eu: number | null;
      numeracao_us: string | null;
      sistema_numeracao: string | null;
      status_item: StatusItem;
      preco_venda: number | null;
      moeda_venda: string | null;
      local?: { nome: string | null; tipo_regiao: string | null; ativo: boolean | null } | Array<{ nome: string | null; tipo_regiao: string | null; ativo: boolean | null }> | null;
    }>)
      .map((row) => {
        const local = Array.isArray(row.local) ? row.local[0] : row.local;
        return { row, local };
      })
      .filter(({ local }) => local?.ativo && local?.tipo_regiao === "europa")
      .map(({ row, local }) => ({
        id_item_estoque: row.id,
        sku: row.sku,
        numeracao_br: row.numeracao_br,
        numeracao_eu: row.numeracao_eu,
        numeracao_us: row.numeracao_us,
        sistema_numeracao: row.sistema_numeracao,
        preco: row.preco_venda,
        moeda: resolverMoedaVendaItem(row.moeda_venda, local?.tipo_regiao),
        estoque: local?.nome ?? null,
        local_nome: local?.nome ?? null,
        status_item: row.status_item,
      }));

    return mapped;
  },
};
