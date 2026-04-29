import type { Database } from "../../../tipos/database.js";
import type { DadosModeloParseados } from "../../tiny/tinyParser.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

type UpdateModelo = Database["public"]["Tables"]["modelos_produto"]["Update"];

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

async function buscarPrimeiroMesmoNomeComAlgumaMarca(
  supabase: SupabaseAppClient,
  nomeModelo: string,
): Promise<{ id: string } | null> {
  const r = await supabase
    .from("modelos_produto")
    .select("id")
    .eq("nome_modelo", nomeModelo)
    .not("id_marca", "is", null)
    .limit(1)
    .maybeSingle();
  if (r.error) throw r.error;
  return r.data;
}

async function atualizarModeloExistente(
  supabase: SupabaseAppClient,
  id: string,
  dados: DadosModeloParseados,
  refs: ReferenciasModelo,
): Promise<void> {
  const atualizacao: UpdateModelo = {
    id_categoria: refs.idCategoria,
    codigo_fabricante: dados.codigoFabricante,
    descricao: dados.descricao,
    origem_cadastro: "tiny",
    ...(dados.idTinyPai ? { id_tiny_pai: dados.idTinyPai } : {}),
  };
  if (refs.idMarca) atualizacao.id_marca = refs.idMarca;

  const upd = await supabase.from("modelos_produto").update(atualizacao).eq("id", id);
  if (upd.error) throw upd.error;
}

export async function upsertModeloProduto(
  supabase: SupabaseAppClient,
  dados: DadosModeloParseados,
  refs: ReferenciasModelo,
): Promise<string> {
  const existente = await buscarPorNomeEMarca(supabase, dados.nomeModelo, refs.idMarca);

  if (existente) {
    await atualizarModeloExistente(supabase, existente.id, dados, refs);
    return existente.id;
  }

  /** Tiny pode primeiro criar modelo sem marca; sync seguinte traz marca → fundir na mesma linha em vez de duplicar. */
  if (refs.idMarca) {
    const orphanSemMarca = await buscarPorNomeEMarca(supabase, dados.nomeModelo, null);
    if (orphanSemMarca) {
      await atualizarModeloExistente(supabase, orphanSemMarca.id, dados, refs);
      return orphanSemMarca.id;
    }
  }

  /** Produto sem marca no Tiny, mas já existe modelo homônimo com marca → evita segundo cadastro só por marca ausente. */
  if (!refs.idMarca) {
    const comMarca = await buscarPrimeiroMesmoNomeComAlgumaMarca(supabase, dados.nomeModelo);
    if (comMarca) {
      await atualizarModeloExistente(supabase, comMarca.id, dados, refs);
      return comMarca.id;
    }
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
