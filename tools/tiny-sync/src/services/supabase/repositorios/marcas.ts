import type { SupabaseAppClient } from "../clienteSupabase.js";

export async function obterOuCriarMarca(
  supabase: SupabaseAppClient,
  nome: string,
): Promise<string> {
  const existente = await supabase
    .from("marcas")
    .select("id")
    .eq("nome", nome)
    .maybeSingle();

  if (existente.error) throw existente.error;
  if (existente.data) return existente.data.id;

  const inserido = await supabase
    .from("marcas")
    .insert({ nome })
    .select("id")
    .single();

  if (inserido.error) {
    const reconsulta = await supabase
      .from("marcas")
      .select("id")
      .eq("nome", nome)
      .single();
    if (reconsulta.error) throw inserido.error;
    return reconsulta.data.id;
  }
  return inserido.data.id;
}
