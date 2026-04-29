export interface TinyEnvelope<TRetorno> {
  retorno: TRetorno;
}

export interface TinyRetornoBase {
  status_processamento: string;
  status: "OK" | "Erro" | string;
  codigo_erro?: string;
  erros?: Array<{ erro: string } | string>;
}

export interface TinyProdutoListagem {
  id: string;
  data_criacao?: string;
  nome: string;
  codigo?: string;
  localizacao?: string;
  preco_custo?: string | number;
  preco_custo_medio?: string | number;
  situacao?: string;
}

export interface TinyRetornoPesquisaProdutos extends TinyRetornoBase {
  pagina?: number;
  numero_paginas?: number;
  produtos?: Array<{ produto: TinyProdutoListagem }>;
}

export interface TinyAnexo {
  anexo?: string;
  url?: string;
  nome?: string;
}

export type TinyAnexoEntrada = TinyAnexo | { anexo: TinyAnexo } | string;

export interface TinyProdutoDetalhe {
  id: string;
  nome: string;
  codigo?: string;
  localizacao?: string;
  id_fornecedor?: string;
  nome_fornecedor?: string;
  codigo_fornecedor?: string;
  codigo_pelo_fornecedor?: string;
  preco_custo?: string | number;
  preco_custo_medio?: string | number;
  preco?: string | number;
  situacao?: string;
  marca?: string;
  categoria?: string;
  descricao_complementar?: string;
  obs?: string;
  unidade_por_caixa?: string | number;
  idProdutoPai?: string;
  id_produto_pai?: string;
  data_criacao?: string;
  anexos?: TinyAnexoEntrada[];
  [chave: string]: unknown;
}

export interface TinyRetornoObterProduto extends TinyRetornoBase {
  produto?: TinyProdutoDetalhe;
}

/** Resposta de produto.obter.estoque.php */
export interface TinyProdutoEstoque {
  id: string;
  nome?: string;
  codigo?: string;
  unidade?: string;
  saldo?: number | string;
  saldoReservado?: number | string;
  depositos?: Array<{ deposito?: Record<string, unknown> }>;
  [chave: string]: unknown;
}

export interface TinyRetornoObterEstoqueProduto extends TinyRetornoBase {
  produto?: TinyProdutoEstoque;
}

export interface TinyTipoContato {
  tipo?: string;
}

export interface TinyPessoaContato {
  nome?: string;
  email?: string;
  telefone?: string;
  departamento?: string;
  [chave: string]: unknown;
}

export interface TinyContatoResumo {
  id: string;
  codigo?: string;
  nome?: string;
  fantasia?: string;
  tipo_pessoa?: string;
  cpf_cnpj?: string;
  cidade?: string;
  uf?: string;
  fone?: string;
  email?: string;
  situacao?: string;
  data_criacao?: string;
  tipos_contato?: TinyTipoContato[];
}

export interface TinyContatoDetalhe {
  id: string;
  codigo?: string;
  nome?: string;
  fantasia?: string;
  tipo_pessoa?: string;
  cpf_cnpj?: string;
  ie?: string;
  rg?: string;
  im?: string | null;
  tipo_negocio?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  pais?: string;
  endereco_cobranca?: string | null;
  numero_cobranca?: string | null;
  complemento_cobranca?: string | null;
  bairro_cobranca?: string | null;
  cep_cobranca?: string | null;
  cidade_cobranca?: string | null;
  uf_cobranca?: string | null;
  contatos?: string;
  fone?: string;
  fax?: string;
  celular?: string;
  email?: string;
  email_nfe?: string;
  site?: string;
  crt?: string;
  limite_credito?: number | string;
  situacao?: string;
  obs?: string;
  id_lista_preco?: number | string;
  id_vendedor?: string | number | null;
  nome_vendedor?: string;
  data_criacao?: string;
  data_atualizacao?: string;
  tipos_contato?: TinyTipoContato[];
  pessoas_contato?: TinyPessoaContato[];
  [chave: string]: unknown;
}

export interface TinyRetornoPesquisaContatos extends TinyRetornoBase {
  pagina?: number;
  numero_paginas?: number;
  contatos?: Array<{ contato: TinyContatoResumo }>;
}

export interface TinyRetornoObterContato extends TinyRetornoBase {
  contato?: TinyContatoDetalhe;
}

export class TinyApiError extends Error {
  readonly status: number | null;
  readonly codigoErro: string | null;
  readonly endpoint: string;
  readonly corpoBruto: unknown;
  readonly temporario: boolean;

  constructor(args: {
    mensagem: string;
    status: number | null;
    codigoErro?: string | null;
    endpoint: string;
    corpoBruto?: unknown;
    temporario?: boolean;
  }) {
    super(args.mensagem);
    this.name = "TinyApiError";
    this.status = args.status;
    this.codigoErro = args.codigoErro ?? null;
    this.endpoint = args.endpoint;
    this.corpoBruto = args.corpoBruto ?? null;
    this.temporario = args.temporario ?? false;
  }
}
