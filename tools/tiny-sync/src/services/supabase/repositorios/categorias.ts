import { normalizarNomeCategoriaTiny } from "../../../utils/normalizacao.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

export async function obterOuCriarCategoria(
  supabase: SupabaseAppClient,
  nome: string,
): Promise<string> {
  const nomeCrm = normalizarNomeCategoriaTiny(nome);
  if (!nomeCrm) {
    throw new Error(`Nome de categoria invalido apos normalizar (Tiny): ${JSON.stringify(nome)}`);
  }

  const existente = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", nomeCrm)
    .maybeSingle();

  if (existente.error) throw existente.error;
  if (existente.data) return existente.data.id;

  const inserido = await supabase
    .from("categorias")
    .insert({ nome: nomeCrm })
    .select("id")
    .single();

  if (inserido.error) {
    const reconsulta = await supabase
      .from("categorias")
      .select("id")
      .eq("nome", nomeCrm)
      .single();
    if (reconsulta.error) throw inserido.error;
    return reconsulta.data.id;
  }
  return inserido.data.id;
}
