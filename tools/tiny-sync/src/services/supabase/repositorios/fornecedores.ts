import type { Database, Json } from "../../../tipos/database.js";
import type { FornecedorTinyParseado } from "../../tiny/tinyParserContatos.js";
import type { DadosFornecedorParseados } from "../../tiny/tinyParser.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

type FornecedorInsert = Database["public"]["Tables"]["fornecedores"]["Insert"];
type FornecedorUpdate = Database["public"]["Tables"]["fornecedores"]["Update"];

export type ResultadoUpsertFornecedor = {
  id: string;
  operacao: "criado" | "atualizado";
};

export async function upsertFornecedor(
  supabase: SupabaseAppClient,
  dados: DadosFornecedorParseados,
): Promise<string | null> {
  if (dados.idTiny) {
    const porIdTiny = await supabase
      .from("fornecedores")
      .select("id")
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
      return porIdTiny.data.id;
    }
  }

  if (dados.nome) {
    const porNome = await supabase
      .from("fornecedores")
      .select("id, id_tiny")
      .eq("nome", dados.nome)
      .maybeSingle();
    if (porNome.error) throw porNome.error;
    if (porNome.data) {
      if (dados.idTiny && !porNome.data.id_tiny) {
        await supabase
          .from("fornecedores")
          .update({
            id_tiny: dados.idTiny,
            codigo_fornecedor: dados.codigoFornecedor ?? undefined,
          })
          .eq("id", porNome.data.id);
      }
      return porNome.data.id;
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
): Promise<string | null> {
  const porIdTiny = await supabase
    .from("fornecedores")
    .select("id")
    .eq("id_tiny", dados.idTiny)
    .maybeSingle();
  if (porIdTiny.error) throw porIdTiny.error;
  if (porIdTiny.data) return porIdTiny.data.id;

  if (dados.cpfCnpj) {
    const porDoc = await supabase
      .from("fornecedores")
      .select("id")
      .eq("cpf_cnpj", dados.cpfCnpj)
      .maybeSingle();
    if (porDoc.error) throw porDoc.error;
    if (porDoc.data) return porDoc.data.id;
  }

  const porNome = await supabase
    .from("fornecedores")
    .select("id")
    .eq("nome", dados.nome)
    .is("id_tiny", null)
    .maybeSingle();
  if (porNome.error) throw porNome.error;
  if (porNome.data) return porNome.data.id;

  return null;
}

export async function upsertFornecedorCompleto(
  supabase: SupabaseAppClient,
  dados: FornecedorTinyParseado,
): Promise<ResultadoUpsertFornecedor> {
  const idExistente = await localizarExistente(supabase, dados);
  const payload = montarPayloadFornecedor(dados);

  if (idExistente) {
    const atualizado = await supabase
      .from("fornecedores")
      .update(payload satisfies FornecedorUpdate)
      .eq("id", idExistente)
      .select("id")
      .single();
    if (atualizado.error) throw atualizado.error;
    return { id: atualizado.data.id, operacao: "atualizado" };
  }

  const inserido = await supabase
    .from("fornecedores")
    .insert(payload)
    .select("id")
    .single();
  if (inserido.error) throw inserido.error;
  return { id: inserido.data.id, operacao: "criado" };
}
