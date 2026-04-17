import type { Database } from "./database";

type Tables = Database["public"]["Tables"];

export type Marca = Tables["marcas"]["Row"];
export type MarcaInsert = Tables["marcas"]["Insert"];
export type MarcaUpdate = Tables["marcas"]["Update"];

export type Categoria = Tables["categorias"]["Row"];
export type CategoriaInsert = Tables["categorias"]["Insert"];
export type CategoriaUpdate = Tables["categorias"]["Update"];

export type Fornecedor = Tables["fornecedores"]["Row"];
export type FornecedorInsert = Tables["fornecedores"]["Insert"];
export type FornecedorUpdate = Tables["fornecedores"]["Update"];

export type LocalEstoque = Tables["locais_estoque"]["Row"];
export type LocalEstoqueInsert = Tables["locais_estoque"]["Insert"];
export type LocalEstoqueUpdate = Tables["locais_estoque"]["Update"];

export type ModeloProduto = Tables["modelos_produto"]["Row"];
export type ModeloProdutoInsert = Tables["modelos_produto"]["Insert"];
export type ModeloProdutoUpdate = Tables["modelos_produto"]["Update"];

export type ImagemModeloProduto = Tables["imagens_modelo_produto"]["Row"];

export type ItemEstoque = Tables["itens_estoque"]["Row"];
export type ItemEstoqueInsert = Tables["itens_estoque"]["Insert"];
export type ItemEstoqueUpdate = Tables["itens_estoque"]["Update"];

export type Cliente = Tables["clientes"]["Row"];
export type ClienteInsert = Tables["clientes"]["Insert"];
export type ClienteUpdate = Tables["clientes"]["Update"];

export type Venda = Tables["vendas"]["Row"];
export type VendaInsert = Tables["vendas"]["Insert"];
export type VendaUpdate = Tables["vendas"]["Update"];

export type ItemVenda = Tables["itens_venda"]["Row"];
export type MovimentacaoEstoque = Tables["movimentacoes_estoque"]["Row"];

export type CambioMoeda = Tables["cambios_moeda"]["Row"];
export type CambioMoedaInsert = Tables["cambios_moeda"]["Insert"];
export type CambioMoedaUpdate = Tables["cambios_moeda"]["Update"];

export type LogSincronizacaoTiny = Tables["logs_sincronizacao_tiny"]["Row"];

export type PapelUsuario = "admin" | "operador";

export interface PerfilUsuario {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface PerfilUsuarioUpdate {
  nome?: string;
  papel?: PapelUsuario;
  ativo?: boolean;
}

export type StatusItem = Database["public"]["Enums"]["status_item_enum"];
export type CondicaoItem = Database["public"]["Enums"]["condicao_item_enum"];
export type SistemaNumeracao = Database["public"]["Enums"]["sistema_numeracao_enum"];
export type StatusVenda = Database["public"]["Enums"]["status_venda_enum"];
export type CanalVenda = Database["public"]["Enums"]["canal_venda_enum"];
export type TipoPessoa = Database["public"]["Enums"]["tipo_pessoa_enum"];
export type SituacaoFornecedor = Database["public"]["Enums"]["situacao_fornecedor_enum"];
export type TipoRegiao = Database["public"]["Enums"]["tipo_regiao_enum"];
export type OrigemCadastro = Database["public"]["Enums"]["origem_cadastro_enum"];
export type TipoMovimentacao = Database["public"]["Enums"]["tipo_movimentacao_enum"];
export type StatusSincronizacao = Database["public"]["Enums"]["status_sincronizacao_enum"];
export type TipoSincronizacaoTiny =
  Database["public"]["Enums"]["tipo_sincronizacao_tiny_enum"];
export type TipoOrigemImagem = Database["public"]["Enums"]["tipo_origem_imagem_enum"];

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  ascending?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
