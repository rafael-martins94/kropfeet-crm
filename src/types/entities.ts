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

export type OrdemCompra = Tables["ordens_compra"]["Row"];
export type OrdemCompraInsert = Tables["ordens_compra"]["Insert"];
export type OrdemCompraUpdate = Tables["ordens_compra"]["Update"];

export type Cliente = Tables["clientes"]["Row"];
export type ClienteInsert = Tables["clientes"]["Insert"];
export type ClienteUpdate = Tables["clientes"]["Update"];

export type EnderecoCliente = Tables["enderecos_cliente"]["Row"];
export type EnderecoClienteInsert = Tables["enderecos_cliente"]["Insert"];
export type EnderecoClienteUpdate = Tables["enderecos_cliente"]["Update"];

export type Vendedor = Tables["vendedores"]["Row"];
export type VendedorInsert = Tables["vendedores"]["Insert"];
export type VendedorUpdate = Tables["vendedores"]["Update"];

export type FormaEnvio = Tables["formas_envio"]["Row"];
export type FormaEnvioInsert = Tables["formas_envio"]["Insert"];
export type FormaEnvioUpdate = Tables["formas_envio"]["Update"];

export type Venda = Tables["vendas"]["Row"];
export type VendaInsert = Tables["vendas"]["Insert"];
export type VendaUpdate = Tables["vendas"]["Update"];

export type FreteStatus = Database["public"]["Enums"]["frete_status_enum"];
export type LocalVenda = Database["public"]["Enums"]["local_venda_enum"];

export type ItemVenda = Tables["itens_venda"]["Row"];
export type ParcelaVenda = Tables["parcelas_venda"]["Row"];
export type ParcelaVendaInsert = Tables["parcelas_venda"]["Insert"];
export type ParcelaVendaUpdate = Tables["parcelas_venda"]["Update"];
export type MovimentacaoEstoque = Tables["movimentacoes_estoque"]["Row"];

export type Conferencia = Tables["conferencias"]["Row"];
export type ConferenciaInsert = Tables["conferencias"]["Insert"];

export type ConferenciaEstoque = Tables["conferencias_estoque"]["Row"];
export type ConferenciaEstoqueInsert = Tables["conferencias_estoque"]["Insert"];

export type Vitrine = Tables["vitrines"]["Row"];
export type VitrineInsert = Tables["vitrines"]["Insert"];
export type VitrineUpdate = Tables["vitrines"]["Update"];

export type VitrineItem = Tables["vitrine_itens"]["Row"];
export type VitrineItemInsert = Tables["vitrine_itens"]["Insert"];
export type VitrineItemUpdate = Tables["vitrine_itens"]["Update"];

export type VitrineDestinoSaida = Tables["vitrine_destinos_saida"]["Row"];
export type VitrineDestinoSaidaInsert = Tables["vitrine_destinos_saida"]["Insert"];
export type VitrineDestinoSaidaUpdate = Tables["vitrine_destinos_saida"]["Update"];

export type VitrineVersao = Tables["vitrine_versoes"]["Row"];
export type EstadoCaixaVitrine = Database["public"]["Enums"]["estado_caixa_vitrine_enum"];
export type MotivoVersaoVitrine = Database["public"]["Enums"]["motivo_versao_vitrine_enum"];

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

export type StatusConferencia = Database["public"]["Enums"]["status_conferencia_enum"];
export type StatusItem = Database["public"]["Enums"]["status_item_enum"];
export type StatusVitrine = Database["public"]["Enums"]["status_vitrine_enum"];
export type EtapaVitrine = Database["public"]["Enums"]["etapa_vitrine_enum"];
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
