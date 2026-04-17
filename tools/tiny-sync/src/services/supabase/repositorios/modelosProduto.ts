import type { DadosModeloParseados } from "../../tiny/tinyParser.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

export interface ReferenciasModelo {
  idMarca: string | null;
  idCategoria: string | null;
}

async function gerarSlugUnico(
  supabase: SupabaseAppClient,
  slugBase: string,
): Promise<string> {
  let tentativa = slugBase;
  let sufixo = 1;
  while (true) {
    const check = await supabase
      .from("modelos_produto")
      .select("id")
      .eq("slug", tentativa)
      .maybeSingle();
    if (check.error) throw check.error;
    if (!check.data) return tentativa;
    sufixo += 1;
    tentativa = `${slugBase}-${sufixo}`;
  }
}

async function buscarPorNomeEMarca(
  supabase: SupabaseAppClient,
  nomeModelo: string,
  idMarca: string | null,
): Promise<{ id: string } | null> {
  let consulta = supabase
    .from("modelos_produto")
    .select("id")
    .eq("nome_modelo", nomeModelo);

  consulta = idMarca ? consulta.eq("id_marca", idMarca) : consulta.is("id_marca", null);

  const r = await consulta.maybeSingle();
  if (r.error) throw r.error;
  return r.data;
}

export async function upsertModeloProduto(
  supabase: SupabaseAppClient,
  dados: DadosModeloParseados,
  refs: ReferenciasModelo,
): Promise<string> {
  const existente = await buscarPorNomeEMarca(
    supabase,
    dados.nomeModelo,
    refs.idMarca,
  );

  if (existente) {
    const atualizacao = {
      id_categoria: refs.idCategoria,
      codigo_fabricante: dados.codigoFabricante,
      descricao: dados.descricao,
      origem_cadastro: "tiny" as const,
      ...(dados.idTinyPai ? { id_tiny_pai: dados.idTinyPai } : {}),
    };
    const upd = await supabase
      .from("modelos_produto")
      .update(atualizacao)
      .eq("id", existente.id);
    if (upd.error) throw upd.error;
    return existente.id;
  }

  const slug = await gerarSlugUnico(supabase, dados.slug);

  const inserido = await supabase
    .from("modelos_produto")
    .insert({
      nome_modelo: dados.nomeModelo,
      slug,
      id_marca: refs.idMarca,
      id_categoria: refs.idCategoria,
      id_tiny_pai: dados.idTinyPai,
      codigo_fabricante: dados.codigoFabricante,
      descricao: dados.descricao,
      origem_cadastro: "tiny",
    })
    .select("id")
    .single();

  if (inserido.error) throw inserido.error;
  return inserido.data.id;
}
