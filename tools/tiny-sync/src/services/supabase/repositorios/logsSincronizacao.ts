import type { Database, Json } from "../../../tipos/database.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

type TipoSync = Database["public"]["Enums"]["tipo_sincronizacao_tiny_enum"];
type StatusSync = Database["public"]["Enums"]["status_sincronizacao_enum"];

export interface LogSyncIniciado {
  id: string;
}

export async function iniciarLogSync(
  supabase: SupabaseAppClient,
  dados: {
    tipoSincronizacao: TipoSync;
    endpointTiny: string;
    pagina?: number | null;
  },
): Promise<LogSyncIniciado> {
  const r = await supabase
    .from("logs_sincronizacao_tiny")
    .insert({
      tipo_sincronizacao: dados.tipoSincronizacao,
      endpoint_tiny: dados.endpointTiny,
      pagina: dados.pagina ?? null,
      status: "em_andamento",
    })
    .select("id")
    .single();
  if (r.error) throw r.error;
  return { id: r.data.id };
}

export interface AtualizacaoLogSync {
  status: StatusSync;
  quantidadeRecebida?: number;
  quantidadeCriada?: number;
  quantidadeAtualizada?: number;
  mensagemErro?: string | null;
  respostaBruta?: Json | null;
  pagina?: number | null;
}

export async function finalizarLogSync(
  supabase: SupabaseAppClient,
  idLog: string,
  atualizacao: AtualizacaoLogSync,
): Promise<void> {
  const r = await supabase
    .from("logs_sincronizacao_tiny")
    .update({
      status: atualizacao.status,
      finalizado_em: new Date().toISOString(),
      quantidade_recebida: atualizacao.quantidadeRecebida ?? 0,
      quantidade_criada: atualizacao.quantidadeCriada ?? 0,
      quantidade_atualizada: atualizacao.quantidadeAtualizada ?? 0,
      mensagem_erro: atualizacao.mensagemErro ?? null,
      resposta_bruta: atualizacao.respostaBruta ?? null,
      pagina: atualizacao.pagina ?? null,
    })
    .eq("id", idLog);
  if (r.error) throw r.error;
}
