import type { Database, Json } from "../../../tipos/database.js";
import type { FornecedorTinyParseado } from "../../tiny/tinyParserContatos.js";
import type { DadosFornecedorParseados } from "../../tiny/tinyParser.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

type FornecedorInsert = Database["public"]["Tables"]["fornecedores"]["Insert"];
type FornecedorUpdate = Database["public"]["Tables"]["fornecedores"]["Update"];

interface FornecedorLocalizado {
  id: string;
  idTinyAtual: string | null;
}

export type ResultadoUpsertFornecedor = {
  id: string;
  operacao: "criado" | "atualizado";
};

function normalizarNomeFornecedor(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toLowerCase();
}

async function buscarFornecedorPorId(
  supabase: SupabaseAppClient,
  id: string,
): Promise<FornecedorLocalizado | null> {
  const r = await supabase
    .from("fornecedores")
    .select("id, id_tiny")
    .eq("id", id)
    .maybeSingle();
  if (r.error) throw r.error;
  return r.data ? { id: r.data.id, idTinyAtual: r.data.id_tiny ?? null } : null;
}

async function buscarFornecedorPorAliasTiny(
  supabase: SupabaseAppClient,
  idTiny: string,
): Promise<FornecedorLocalizado | null> {
  const alias = await supabase
    .from("fornecedor_tiny_ids")
    .select("id_fornecedor")
    .eq("id_tiny", idTiny)
    .maybeSingle();
  if (alias.error) throw alias.error;
  if (!alias.data?.id_fornecedor) return null;
  return buscarFornecedorPorId(supabase, alias.data.id_fornecedor);
}

async function registrarAliasTiny(
  supabase: SupabaseAppClient,
  idFornecedor: string,
  idTiny: string | null,
  dadosTiny?: Record<string, unknown> | null,
): Promise<void> {
  if (!idTiny) return;
  const r = await supabase
    .from("fornecedor_tiny_ids")
    .upsert(
      {
        id_fornecedor: idFornecedor,
        id_tiny: idTiny,
        dados_tiny: (dadosTiny ?? null) as Json | null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id_tiny" },
    );
  if (r.error) throw r.error;
}

async function buscarPorNomeNormalizado(
  supabase: SupabaseAppClient,
  nome: string,
): Promise<FornecedorLocalizado | null> {
  const alvo = normalizarNomeFornecedor(nome);
  const r = await supabase
    .from("fornecedores")
    .select("id, id_tiny, nome")
    .ilike("nome", nome)
    .limit(10);
  if (r.error) throw r.error;
  const encontrado = (r.data ?? []).find((f) => normalizarNomeFornecedor(f.nome) === alvo);
  return encontrado
    ? { id: encontrado.id, idTinyAtual: encontrado.id_tiny ?? null }
    : null;
}

export async function upsertFornecedor(
  supabase: SupabaseAppClient,
  dados: DadosFornecedorParseados,
): Promise<string | null> {
  if (dados.idTiny) {
    const porAlias = await buscarFornecedorPorAliasTiny(supabase, dados.idTiny);
    if (porAlias) {
      await registrarAliasTiny(supabase, porAlias.id, dados.idTiny);
      return porAlias.id;
    }

    const porIdTiny = await supabase
      .from("fornecedores")
      .select("id, id_tiny")
      .eq("id_tiny", dados.idTiny)
      .maybeSingle();
    if (porIdTiny.error) throw porIdTiny.error;
    if (porIdTiny.data) {
      await supabase
        .from("fornecedores")
        .update({
          nome: dados.nome ?? undefined,
          codigo_fornecedor: dados.codigoFornecedor ?? undefined,
        })
        .eq("id", porIdTiny.data.id);
      await registrarAliasTiny(supabase, porIdTiny.data.id, dados.idTiny);
      return porIdTiny.data.id;
    }
  }

  if (dados.nome) {
    const porNome = await buscarPorNomeNormalizado(supabase, dados.nome);
    if (porNome) {
      if (dados.idTiny && !porNome.idTinyAtual) {
        await supabase
          .from("fornecedores")
          .update({
            id_tiny: dados.idTiny,
            codigo_fornecedor: dados.codigoFornecedor ?? undefined,
          })
          .eq("id", porNome.id);
      }
      await registrarAliasTiny(supabase, porNome.id, dados.idTiny);
      return porNome.id;
    }
  }

  if (!dados.nome) return null;

  const inserido = await supabase
    .from("fornecedores")
    .insert({
      id_tiny: dados.idTiny,
      nome: dados.nome,
      codigo_fornecedor: dados.codigoFornecedor,
    })
    .select("id")
    .single();

  if (inserido.error) throw inserido.error;
  await registrarAliasTiny(supabase, inserido.data.id, dados.idTiny);
  return inserido.data.id;
}

function montarPayloadFornecedor(dados: FornecedorTinyParseado): FornecedorInsert {
  return {
    id_tiny: dados.idTiny,
    nome: dados.nome,
    codigo_fornecedor: dados.codigoFornecedor,
    fantasia: dados.fantasia,
    tipo_pessoa: dados.tipoPessoa,
    cpf_cnpj: dados.cpfCnpj,
    inscricao_estadual: dados.inscricaoEstadual,
    inscricao_municipal: dados.inscricaoMunicipal,
    rg: dados.rg,
    tipo_negocio: dados.tipoNegocio,
    endereco: dados.endereco,
    numero: dados.numero,
    complemento: dados.complemento,
    bairro: dados.bairro,
    cep: dados.cep,
    cidade: dados.cidade,
    uf: dados.uf,
    pais: dados.pais,
    telefone: dados.telefone,
    celular: dados.celular,
    email: dados.email,
    email_nfe: dados.emailNfe,
    site: dados.site,
    situacao: dados.situacao,
    observacoes: dados.observacoes,
    data_cadastro_tiny: dados.dataCadastroTiny,
    data_atualizacao_tiny: dados.dataAtualizacaoTiny,
    dados_tiny: dados.dadosTiny as unknown as Json,
  };
}

async function localizarExistente(
  supabase: SupabaseAppClient,
  dados: FornecedorTinyParseado,
): Promise<FornecedorLocalizado | null> {
  const porAlias = await buscarFornecedorPorAliasTiny(supabase, dados.idTiny);
  if (porAlias) return porAlias;

  const porIdTiny = await supabase
    .from("fornecedores")
    .select("id, id_tiny")
    .eq("id_tiny", dados.idTiny)
    .maybeSingle();
  if (porIdTiny.error) throw porIdTiny.error;
  if (porIdTiny.data) {
    return { id: porIdTiny.data.id, idTinyAtual: porIdTiny.data.id_tiny ?? null };
  }

  if (dados.cpfCnpj) {
    const porDoc = await supabase
      .from("fornecedores")
      .select("id, id_tiny")
      .eq("cpf_cnpj", dados.cpfCnpj)
      .maybeSingle();
    if (porDoc.error) throw porDoc.error;
    if (porDoc.data) return { id: porDoc.data.id, idTinyAtual: porDoc.data.id_tiny ?? null };
  }

  const porNome = await buscarPorNomeNormalizado(supabase, dados.nome);
  if (porNome) return porNome;

  return null;
}

export async function upsertFornecedorCompleto(
  supabase: SupabaseAppClient,
  dados: FornecedorTinyParseado,
): Promise<ResultadoUpsertFornecedor> {
  const existente = await localizarExistente(supabase, dados);
  const payload = montarPayloadFornecedor(dados);

  if (existente) {
    const patch: FornecedorUpdate = { ...payload };
    if (existente.idTinyAtual && existente.idTinyAtual !== dados.idTiny) {
      patch.id_tiny = existente.idTinyAtual;
    }

    const atualizado = await supabase
      .from("fornecedores")
      .update(patch)
      .eq("id", existente.id)
      .select("id")
      .single();
    if (atualizado.error) throw atualizado.error;
    await registrarAliasTiny(supabase, atualizado.data.id, dados.idTiny, dados.dadosTiny);
    return { id: atualizado.data.id, operacao: "atualizado" };
  }

  const inserido = await supabase
    .from("fornecedores")
    .insert(payload)
    .select("id")
    .single();
  if (inserido.error) throw inserido.error;
  await registrarAliasTiny(supabase, inserido.data.id, dados.idTiny, dados.dadosTiny);
  return { id: inserido.data.id, operacao: "criado" };
}
