import type { Database, Json } from "../../../tipos/database.js";
import { normalizarTexto } from "../../../utils/normalizacao.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";
import type { TinyPedidoClienteDetalhe } from "../../tiny/tinyTipos.js";
import type { ClienteTinyParseado } from "../../tiny/tinyParserContatos.js";
import { obterOuCriarEnderecoPorDados } from "./enderecos-cliente.js";

type ClienteUpdate = Database["public"]["Tables"]["clientes"]["Update"];
type ClienteInsert = Database["public"]["Tables"]["clientes"]["Insert"];
type TipoPessoa = Database["public"]["Enums"]["tipo_pessoa_enum"];

export interface ResultadoClientePedido {
  idCliente: string;
  idEndereco: string | null;
}

function mapearTipoPessoa(valor: string | null | undefined): TipoPessoa | null {
  const v = (valor ?? "").trim().toUpperCase();
  if (v === "F") return "fisica";
  if (v === "J") return "juridica";
  return null;
}

function paisPadraoPorRegiao(
  regiao: Database["public"]["Enums"]["tipo_regiao_enum"],
): string {
  if (regiao === "europa") return "Europa";
  if (regiao === "outros") return "Outros";
  return "Brasil";
}

function montarPayloadCliente(
  cliente: TinyPedidoClienteDetalhe | null | undefined,
  pais: string,
): ClienteUpdate | null {
  const nome = normalizarTexto(cliente?.nome);
  if (!nome) return null;

  return {
    nome,
    codigo_tiny: normalizarTexto(cliente?.codigo),
    fantasia: normalizarTexto(cliente?.nome_fantasia),
    tipo_pessoa: mapearTipoPessoa(cliente?.tipo_pessoa as string | undefined),
    cpf_cnpj: normalizarTexto(cliente?.cpf_cnpj),
    inscricao_estadual: normalizarTexto(cliente?.ie),
    rg: normalizarTexto(cliente?.rg),
    email: normalizarTexto(cliente?.email),
    telefone: normalizarTexto(cliente?.fone),
    pais,
    dados_tiny: (cliente ?? null) as unknown as Json,
  };
}

function montarDadosEndereco(
  cliente: TinyPedidoClienteDetalhe | null | undefined,
  pais: string,
) {
  return {
    cep: normalizarTexto(cliente?.cep),
    endereco: normalizarTexto(cliente?.endereco),
    numero: normalizarTexto(cliente?.numero),
    complemento: normalizarTexto(cliente?.complemento),
    bairro: normalizarTexto(cliente?.bairro),
    cidade: normalizarTexto(cliente?.cidade),
    uf: normalizarTexto(cliente?.uf),
    pais,
  };
}

/**
 * Resolve (ou cria/atualiza) um cliente a partir dos dados do pedido Tiny.
 * Casamento por CPF/CNPJ (quando disponivel) ou por nome (case-insensitive).
 */
export async function obterOuCriarClientePorPedido(
  supabase: SupabaseAppClient,
  clienteTiny: TinyPedidoClienteDetalhe | null | undefined,
  regiaoVenda: Database["public"]["Enums"]["tipo_regiao_enum"] = "brasil",
): Promise<ResultadoClientePedido | null> {
  const pais = paisPadraoPorRegiao(regiaoVenda);
  const payload = montarPayloadCliente(clienteTiny, pais);
  if (!payload?.nome) return null;

  let idCliente: string;

  const cpfCnpj = payload.cpf_cnpj;
  if (cpfCnpj) {
    const porDoc = await supabase
      .from("clientes")
      .select("id")
      .eq("cpf_cnpj", cpfCnpj)
      .limit(1)
      .maybeSingle();
    if (porDoc.error) throw porDoc.error;
    if (porDoc.data) {
      const atualizado = await supabase
        .from("clientes")
        .update(payload)
        .eq("id", porDoc.data.id);
      if (atualizado.error) throw atualizado.error;
      idCliente = porDoc.data.id;
    } else {
      const inserido = await supabase
        .from("clientes")
        .insert(payload as ClienteInsert)
        .select("id")
        .single();
      if (inserido.error) throw inserido.error;
      idCliente = inserido.data.id;
    }
  } else {
    const porNome = await supabase
      .from("clientes")
      .select("id")
      .ilike("nome", payload.nome)
      .limit(1)
      .maybeSingle();
    if (porNome.error) throw porNome.error;

    if (porNome.data) {
      const atualizado = await supabase
        .from("clientes")
        .update(payload)
        .eq("id", porNome.data.id);
      if (atualizado.error) throw atualizado.error;
      idCliente = porNome.data.id;
    } else {
      const inserido = await supabase
        .from("clientes")
        .insert(payload as ClienteInsert)
        .select("id")
        .single();
      if (inserido.error) throw inserido.error;
      idCliente = inserido.data.id;
    }
  }

  const idEndereco = await obterOuCriarEnderecoPorDados(
    supabase,
    idCliente,
    montarDadosEndereco(clienteTiny, pais),
    "Entrega Tiny",
  );

  return { idCliente, idEndereco };
}

export type ResultadoUpsertCliente = {
  id: string;
  operacao: "criado" | "atualizado";
  idEndereco: string | null;
};

/**
 * Upsert completo a partir de contato.obter.php.
 * Match: id_tiny → cpf_cnpj → email → nome+pais.
 * Em conflito de e-mail unico, atualiza o registro existente.
 */
export async function upsertClienteCompletoPorContato(
  supabase: SupabaseAppClient,
  dados: ClienteTinyParseado,
  paisPadrao = "Brasil",
  opcoes: { idPreferido?: string | null } = {},
): Promise<ResultadoUpsertCliente> {
  const pais = dados.pais?.trim() || paisPadrao;
  const telefone = dados.telefone ?? dados.celular;

  const payload: ClienteUpdate = {
    id_tiny: dados.idTiny,
    nome: dados.nome,
    codigo_tiny: dados.codigoTiny,
    fantasia: dados.fantasia,
    tipo_pessoa: dados.tipoPessoa,
    cpf_cnpj: dados.cpfCnpj,
    inscricao_estadual: dados.inscricaoEstadual,
    rg: dados.rg,
    email: dados.email,
    telefone,
    observacoes: dados.observacoes,
    pais,
    dados_tiny: dados.dadosTiny as unknown as Json,
  };

  async function buscarIdExistente(): Promise<string | null> {
    if (opcoes.idPreferido) return opcoes.idPreferido;

    const porTiny = await supabase
      .from("clientes")
      .select("id")
      .eq("id_tiny", dados.idTiny)
      .maybeSingle();
    if (porTiny.error) throw porTiny.error;
    if (porTiny.data) return porTiny.data.id;

    if (dados.email) {
      const porEmail = await supabase
        .from("clientes")
        .select("id")
        .ilike("email", dados.email)
        .limit(1)
        .maybeSingle();
      if (porEmail.error) throw porEmail.error;
      if (porEmail.data) return porEmail.data.id;
    }

    if (dados.cpfCnpj) {
      const cpfBruto =
        typeof dados.dadosTiny["cpf_cnpj"] === "string"
          ? String(dados.dadosTiny["cpf_cnpj"]).trim()
          : "";
      const filtros = [`cpf_cnpj.eq.${dados.cpfCnpj}`];
      if (cpfBruto && cpfBruto !== dados.cpfCnpj) {
        filtros.push(`cpf_cnpj.eq.${cpfBruto}`);
      }
      const porDoc = await supabase
        .from("clientes")
        .select("id")
        .or(filtros.join(","))
        .limit(1)
        .maybeSingle();
      if (porDoc.error) throw porDoc.error;
      if (porDoc.data) return porDoc.data.id;
    }

    const porNome = await supabase
      .from("clientes")
      .select("id")
      .ilike("nome", dados.nome)
      .eq("pais", pais)
      .limit(1)
      .maybeSingle();
    if (porNome.error) throw porNome.error;
    if (porNome.data) return porNome.data.id;

    return null;
  }

  let idCliente = await buscarIdExistente();
  let operacao: "criado" | "atualizado" = idCliente ? "atualizado" : "criado";

  if (idCliente) {
    const atualizado = await supabase.from("clientes").update(payload).eq("id", idCliente);
    if (atualizado.error) throw atualizado.error;
  } else {
    const inserido = await supabase
      .from("clientes")
      .insert(payload as ClienteInsert)
      .select("id")
      .single();

    if (inserido.error) {
      // Concorrencia / unique email: tenta atualizar o existente.
      if (inserido.error.code === "23505" && dados.email) {
        const porEmail = await supabase
          .from("clientes")
          .select("id")
          .ilike("email", dados.email)
          .limit(1)
          .maybeSingle();
        if (porEmail.error) throw porEmail.error;
        if (porEmail.data) {
          idCliente = porEmail.data.id;
          operacao = "atualizado";
          const atualizado = await supabase
            .from("clientes")
            .update(payload)
            .eq("id", idCliente);
          if (atualizado.error) throw atualizado.error;
        } else {
          throw inserido.error;
        }
      } else {
        throw inserido.error;
      }
    } else {
      idCliente = inserido.data.id;
      operacao = "criado";
    }
  }

  const idEndereco = await obterOuCriarEnderecoPorDados(
    supabase,
    idCliente,
    {
      cep: dados.cep,
      endereco: dados.endereco,
      numero: dados.numero,
      complemento: dados.complemento,
      bairro: dados.bairro,
      cidade: dados.cidade,
      uf: dados.uf,
      pais,
    },
    "Cadastro Tiny",
  );

  return { id: idCliente, operacao, idEndereco };
}
