import type { Database } from "../../tipos/database.js";
import { normalizarTexto, paraDataIso } from "../../utils/normalizacao.js";
import type { TinyContatoDetalhe, TinyContatoResumo } from "./tinyTipos.js";

type TipoPessoa = Database["public"]["Enums"]["tipo_pessoa_enum"];
type Situacao = Database["public"]["Enums"]["situacao_fornecedor_enum"];

export interface FornecedorTinyParseado {
  idTiny: string;
  nome: string;
  codigoFornecedor: string | null;
  fantasia: string | null;
  tipoPessoa: TipoPessoa | null;
  cpfCnpj: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  rg: string | null;
  tipoNegocio: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  emailNfe: string | null;
  site: string | null;
  situacao: Situacao;
  observacoes: string | null;
  dataCadastroTiny: string | null;
  dataAtualizacaoTiny: string | null;
  dadosTiny: Record<string, unknown>;
}

function somenteDigitos(valor: string | null | undefined): string | null {
  const s = normalizarTexto(valor);
  if (!s) return null;
  const digitos = s.replace(/\D/g, "");
  return digitos.length > 0 ? digitos : null;
}

function normalizarUf(valor: string | null | undefined): string | null {
  const s = normalizarTexto(valor);
  if (!s) return null;
  const up = s.toUpperCase();
  return up.length === 2 ? up : null;
}

function mapearTipoPessoa(valor: string | null | undefined): TipoPessoa | null {
  const s = normalizarTexto(valor)?.toUpperCase();
  if (s === "F") return "fisica";
  if (s === "J") return "juridica";
  return null;
}

function mapearSituacao(valor: string | null | undefined): Situacao {
  const s = normalizarTexto(valor)?.toUpperCase();
  if (s === "I") return "inativo";
  return "ativo";
}

function ehFornecedor(contato: { tipos_contato?: Array<{ tipo?: string }> }): boolean {
  const tipos = contato.tipos_contato ?? [];
  return tipos.some((t) => {
    const nome = (t?.tipo ?? "").toString().trim().toLowerCase();
    return nome === "fornecedor";
  });
}

function ehCliente(contato: { tipos_contato?: Array<{ tipo?: string }> }): boolean {
  const tipos = contato.tipos_contato ?? [];
  // Sem tipos: assume cliente (pesquisa tipo=C ja filtra).
  if (tipos.length === 0) return true;
  return tipos.some((t) => {
    const nome = (t?.tipo ?? "").toString().trim().toLowerCase();
    return nome === "cliente" || nome === "cliente e fornecedor";
  });
}

export function contatoResumoEhFornecedor(resumo: TinyContatoResumo): boolean {
  return ehFornecedor(resumo);
}

export function contatoDetalheEhFornecedor(detalhe: TinyContatoDetalhe): boolean {
  return ehFornecedor(detalhe);
}

export function contatoResumoEhCliente(resumo: TinyContatoResumo): boolean {
  return ehCliente(resumo);
}

export function contatoDetalheEhCliente(detalhe: TinyContatoDetalhe): boolean {
  return ehCliente(detalhe);
}

export interface ClienteTinyParseado {
  idTiny: string;
  nome: string;
  codigoTiny: string | null;
  fantasia: string | null;
  tipoPessoa: TipoPessoa | null;
  cpfCnpj: string | null;
  inscricaoEstadual: string | null;
  rg: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  observacoes: string | null;
  pais: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  dadosTiny: Record<string, unknown>;
}

export function parseClienteTiny(contato: TinyContatoDetalhe): ClienteTinyParseado {
  const nome = normalizarTexto(contato.nome) ?? "(sem nome)";
  const telefone =
    normalizarTexto(contato.fone) ?? normalizarTexto(contato.celular) ?? null;

  return {
    idTiny: String(contato.id),
    nome,
    codigoTiny: normalizarTexto(contato.codigo),
    fantasia: normalizarTexto(contato.fantasia),
    tipoPessoa: mapearTipoPessoa(contato.tipo_pessoa),
    cpfCnpj: somenteDigitos(contato.cpf_cnpj),
    inscricaoEstadual: normalizarTexto(contato.ie),
    rg: normalizarTexto(contato.rg),
    email: normalizarTexto(contato.email)?.toLowerCase() ?? null,
    telefone,
    celular: normalizarTexto(contato.celular),
    observacoes: normalizarTexto(contato.obs),
    pais: normalizarTexto(contato.pais),
    cep: somenteDigitos(contato.cep),
    endereco: normalizarTexto(contato.endereco),
    numero: normalizarTexto(contato.numero),
    complemento: normalizarTexto(contato.complemento),
    bairro: normalizarTexto(contato.bairro),
    cidade: normalizarTexto(contato.cidade),
    uf: normalizarUf(contato.uf),
    dadosTiny: contato as unknown as Record<string, unknown>,
  };
}

export function parseFornecedorTiny(contato: TinyContatoDetalhe): FornecedorTinyParseado {
  const nome = normalizarTexto(contato.nome) ?? "(sem nome)";

  return {
    idTiny: String(contato.id),
    nome,
    codigoFornecedor: normalizarTexto(contato.codigo),
    fantasia: normalizarTexto(contato.fantasia),
    tipoPessoa: mapearTipoPessoa(contato.tipo_pessoa),
    cpfCnpj: somenteDigitos(contato.cpf_cnpj),
    inscricaoEstadual: normalizarTexto(contato.ie),
    inscricaoMunicipal: normalizarTexto(
      typeof contato.im === "string" ? contato.im : undefined,
    ),
    rg: normalizarTexto(contato.rg),
    tipoNegocio: normalizarTexto(contato.tipo_negocio),
    endereco: normalizarTexto(contato.endereco),
    numero: normalizarTexto(contato.numero),
    complemento: normalizarTexto(contato.complemento),
    bairro: normalizarTexto(contato.bairro),
    cep: somenteDigitos(contato.cep),
    cidade: normalizarTexto(contato.cidade),
    uf: normalizarUf(contato.uf),
    pais: normalizarTexto(contato.pais),
    telefone: normalizarTexto(contato.fone),
    celular: normalizarTexto(contato.celular),
    email: normalizarTexto(contato.email)?.toLowerCase() ?? null,
    emailNfe: normalizarTexto(contato.email_nfe)?.toLowerCase() ?? null,
    site: normalizarTexto(contato.site),
    situacao: mapearSituacao(contato.situacao),
    observacoes: normalizarTexto(contato.obs),
    dataCadastroTiny: paraDataIso(contato.data_criacao),
    dataAtualizacaoTiny: paraDataIso(contato.data_atualizacao),
    dadosTiny: contato as unknown as Record<string, unknown>,
  };
}
