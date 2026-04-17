import type { DadosLocalEstoqueParseado } from "../../tiny/tinyParser.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

export async function obterOuCriarLocalEstoque(
  supabase: SupabaseAppClient,
  dados: DadosLocalEstoqueParseado,
): Promise<string> {
  const existente = await supabase
    .from("locais_estoque")
    .select("id")
    .eq("codigo", dados.codigo)
    .maybeSingle();

  if (existente.error) throw existente.error;
  if (existente.data) return existente.data.id;

  const inserido = await supabase
    .from("locais_estoque")
    .insert({
      codigo: dados.codigo,
      nome: dados.nome,
      tipo_regiao: dados.tipoRegiao,
    })
    .select("id")
    .single();

  if (inserido.error) {
    const reconsulta = await supabase
      .from("locais_estoque")
      .select("id")
      .eq("codigo", dados.codigo)
      .single();
    if (reconsulta.error) throw inserido.error;
    return reconsulta.data.id;
  }
  return inserido.data.id;
}
