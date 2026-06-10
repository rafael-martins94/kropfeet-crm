import { supabase } from "../lib/supabase";
import type { StatusItem } from "../types/entities";

export type SituacaoConferenciaFiltro = "" | "pendentes" | "conferidos";

export const situacaoConferenciaOpcoes: Array<{
  value: SituacaoConferenciaFiltro;
  label: string;
}> = [
  { value: "", label: "Todos os itens" },
  { value: "pendentes", label: "Pendentes de conferência" },
  { value: "conferidos", label: "Conferidos hoje" },
];

export interface ConferenciaHojeInfo {
  id: string;
  conferidoEm: string;
  idUsuario: string;
  nomeUsuario: string | null;
  statusAnterior: StatusItem | null;
}

export interface ConferenciaHistoricoDia {
  data: string;
  totalItens: number;
}

function dataHojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const conferenciasEstoqueService = {
  conferirItem: async (idItem: string, idLocal?: string | null): Promise<string> => {
    const { data, error } = await supabase.rpc("conferir_item_estoque", {
      p_id_item: idItem,
      p_id_local: idLocal ?? undefined,
    });
    if (error) throw error;
    return data as string;
  },

  desfazerConferencia: async (idItem: string): Promise<void> => {
    const { error } = await supabase.rpc("desfazer_conferencia_item", {
      p_id_item: idItem,
    });
    if (error) throw error;
  },

  idsItensConferidosNaData: async (data: string): Promise<string[]> => {
    const { data: rows, error } = await supabase
      .from("conferencias_estoque")
      .select("id_item_estoque")
      .eq("data_conferencia", data);

    if (error) throw error;
    return (rows ?? []).map((r) => r.id_item_estoque);
  },

  mapaConferidosHoje: async (idsItens: string[]): Promise<Map<string, ConferenciaHojeInfo>> => {
    const mapa = new Map<string, ConferenciaHojeInfo>();
    if (idsItens.length === 0) return mapa;

    const { data, error } = await supabase
      .from("conferencias_estoque")
      .select("id, conferido_em, id_usuario, id_item_estoque, status_item_anterior")
      .eq("data_conferencia", dataHojeIso())
      .in("id_item_estoque", idsItens);

    if (error) throw error;

    const rows = data ?? [];
    const idsUsuarios = [...new Set(rows.map((r) => r.id_usuario))];
    const nomesPorUsuario = new Map<string, string>();

    if (idsUsuarios.length > 0) {
      const { data: perfis, error: perfisError } = await (
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

      if (!perfisError) {
        for (const p of perfis ?? []) {
          nomesPorUsuario.set(p.id, p.nome);
        }
      }
    }

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

  /** Totais de itens conferidos agrupados por dia, do mais recente ao mais antigo. */
  historicoResumoPorData: async (): Promise<ConferenciaHistoricoDia[]> => {
    const contagem = new Map<string, number>();
    const chunkSize = 1000;

    for (let offset = 0; ; offset += chunkSize) {
      const { data, error } = await supabase
        .from("conferencias_estoque")
        .select("data_conferencia")
        .order("data_conferencia", { ascending: false })
        .range(offset, offset + chunkSize - 1);

      if (error) throw error;

      const lote = data ?? [];
      for (const row of lote) {
        contagem.set(row.data_conferencia, (contagem.get(row.data_conferencia) ?? 0) + 1);
      }
      if (lote.length < chunkSize) break;
    }

    return [...contagem.entries()]
      .map(([data, totalItens]) => ({ data, totalItens }))
      .sort((a, b) => b.data.localeCompare(a.data));
  },
};
