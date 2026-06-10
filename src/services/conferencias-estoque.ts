import { supabase } from "../lib/supabase";
import type { Conferencia, PaginatedResult, StatusConferencia, StatusItem } from "../types/entities";

export type SituacaoConferenciaFiltro = "" | "pendentes" | "conferidos";

export const situacaoConferenciaOpcoes: Array<{
  value: SituacaoConferenciaFiltro;
  label: string;
}> = [
  { value: "", label: "Todos" },
  { value: "pendentes", label: "Pendente" },
  { value: "conferidos", label: "Conferido" },
];

export interface ConferenciaItemInfo {
  id: string;
  conferidoEm: string;
  idUsuario: string;
  nomeUsuario: string | null;
  statusAnterior: StatusItem | null;
}

export interface ConferenciaResumo extends Conferencia {
  totalItensConferidos: number;
  nomeUsuario: string | null;
}

export const conferenciasEstoqueService = {
  listar: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: StatusConferencia | "";
  }): Promise<PaginatedResult<ConferenciaResumo>> => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 25;
    const termo = params?.search?.trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("conferencias")
      .select("*", { count: "exact" })
      .order("criado_em", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.ilike("nome", padrao);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const conferencias = data ?? [];
    const ids = conferencias.map((c) => c.id);
    const idsUsuarios = [...new Set(conferencias.map((c) => c.id_usuario))];

    const [contagens, nomesPorUsuario] = await Promise.all([
      conferenciasEstoqueService.contagemItensPorConferencia(ids),
      conferenciasEstoqueService.nomesUsuarios(idsUsuarios),
    ]);

    return {
      data: conferencias.map((c) => ({
        ...c,
        totalItensConferidos: contagens.get(c.id) ?? 0,
        nomeUsuario: nomesPorUsuario.get(c.id_usuario) ?? null,
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  obter: async (id: string): Promise<ConferenciaResumo | null> => {
    const { data, error } = await supabase.from("conferencias").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const [contagens, nomesPorUsuario] = await Promise.all([
      conferenciasEstoqueService.contagemItensPorConferencia([data.id]),
      conferenciasEstoqueService.nomesUsuarios([data.id_usuario]),
    ]);

    return {
      ...data,
      totalItensConferidos: contagens.get(data.id) ?? 0,
      nomeUsuario: nomesPorUsuario.get(data.id_usuario) ?? null,
    };
  },

  criar: async (nome: string): Promise<string> => {
    const { data, error } = await supabase.rpc("criar_conferencia_estoque", {
      p_nome: nome.trim(),
    });
    if (error) throw error;
    return data as string;
  },

  fechar: async (idConferencia: string): Promise<void> => {
    const { error } = await supabase.rpc("fechar_conferencia_estoque", {
      p_id_conferencia: idConferencia,
    });
    if (error) throw error;
  },

  conferirItem: async (
    idItem: string,
    idConferencia: string,
    idLocal?: string | null,
  ): Promise<string> => {
    const { data, error } = await supabase.rpc("conferir_item_estoque", {
      p_id_item: idItem,
      p_id_conferencia: idConferencia,
      p_id_local: idLocal ?? undefined,
    });
    if (error) throw error;
    return data as string;
  },

  desfazerConferencia: async (idItem: string, idConferencia: string): Promise<void> => {
    const { error } = await supabase.rpc("desfazer_conferencia_item", {
      p_id_item: idItem,
      p_id_conferencia: idConferencia,
    });
    if (error) throw error;
  },

  idsItensConferidosNaConferencia: async (idConferencia: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("conferencias_estoque")
      .select("id_item_estoque")
      .eq("id_conferencia", idConferencia);

    if (error) throw error;
    return (data ?? []).map((r) => r.id_item_estoque);
  },

  mapaConferidosNaConferencia: async (
    idsItens: string[],
    idConferencia: string,
  ): Promise<Map<string, ConferenciaItemInfo>> => {
    const mapa = new Map<string, ConferenciaItemInfo>();
    if (idsItens.length === 0) return mapa;

    const { data, error } = await supabase
      .from("conferencias_estoque")
      .select("id, conferido_em, id_usuario, id_item_estoque, status_item_anterior")
      .eq("id_conferencia", idConferencia)
      .in("id_item_estoque", idsItens);

    if (error) throw error;

    const rows = data ?? [];
    const idsUsuarios = [...new Set(rows.map((r) => r.id_usuario))];
    const nomesPorUsuario = await conferenciasEstoqueService.nomesUsuarios(idsUsuarios);

    for (const row of rows) {
      mapa.set(row.id_item_estoque, {
        id: row.id,
        conferidoEm: row.conferido_em,
        idUsuario: row.id_usuario,
        nomeUsuario: nomesPorUsuario.get(row.id_usuario) ?? null,
        statusAnterior: row.status_item_anterior,
      });
    }

    return mapa;
  },

  contagemItensPorConferencia: async (idsConferencias: string[]): Promise<Map<string, number>> => {
    const mapa = new Map<string, number>();
    if (idsConferencias.length === 0) return mapa;

    const { data, error } = await supabase
      .from("conferencias_estoque")
      .select("id_conferencia")
      .in("id_conferencia", idsConferencias);

    if (error) throw error;

    for (const row of data ?? []) {
      if (!row.id_conferencia) continue;
      mapa.set(row.id_conferencia, (mapa.get(row.id_conferencia) ?? 0) + 1);
    }

    return mapa;
  },

  nomesUsuarios: async (idsUsuarios: string[]): Promise<Map<string, string>> => {
    const mapa = new Map<string, string>();
    if (idsUsuarios.length === 0) return mapa;

    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            in: (c: string, v: string[]) => Promise<{
              data: Array<{ id: string; nome: string }> | null;
              error: unknown;
            }>;
          };
        };
      }
    )
      .from("perfis_usuario")
      .select("id, nome")
      .in("id", idsUsuarios);

    if (!error) {
      for (const p of data ?? []) {
        mapa.set(p.id, p.nome);
      }
    }

    return mapa;
  },
};
