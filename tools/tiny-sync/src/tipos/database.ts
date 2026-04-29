export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cambios_moeda: {
        Row: {
          criado_em: string
          data_cotacao: string
          fonte: string | null
          id: string
          moeda_destino: string
          moeda_origem: string
          valor_cotacao: number
        }
        Insert: {
          criado_em?: string
          data_cotacao: string
          fonte?: string | null
          id?: string
          moeda_destino: string
          moeda_origem: string
          valor_cotacao: number
        }
        Update: {
          criado_em?: string
          data_cotacao?: string
          fonte?: string | null
          id?: string
          moeda_destino?: string
          moeda_origem?: string
          valor_cotacao?: number
        }
        Relationships: []
      }
      categorias: {
        Row: { criado_em: string; id: string; nome: string }
        Insert: { criado_em?: string; id?: string; nome: string }
        Update: { criado_em?: string; id?: string; nome?: string }
        Relationships: []
      }
      clientes: {
        Row: {
          atualizado_em: string
          criado_em: string
          email: string | null
          id: string
          instagram: string | null
          nome: string
          observacoes: string | null
          pais: string | null
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          id?: string
          instagram?: string | null
          nome: string
          observacoes?: string | null
          pais?: string | null
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          id?: string
          instagram?: string | null
          nome?: string
          observacoes?: string | null
          pais?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          atualizado_em: string
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          codigo_fornecedor: string | null
          complemento: string | null
          cpf_cnpj: string | null
          criado_em: string
          dados_tiny: Json | null
          data_atualizacao_tiny: string | null
          data_cadastro_tiny: string | null
          email: string | null
          email_nfe: string | null
          endereco: string | null
          fantasia: string | null
          id: string
          id_tiny: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          pais: string | null
          rg: string | null
          site: string | null
          situacao: Database["public"]["Enums"]["situacao_fornecedor_enum"]
          telefone: string | null
          tipo_negocio: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa_enum"] | null
          uf: string | null
        }
        Insert: {
          atualizado_em?: string
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_fornecedor?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_atualizacao_tiny?: string | null
          data_cadastro_tiny?: string | null
          email?: string | null
          email_nfe?: string | null
          endereco?: string | null
          fantasia?: string | null
          id?: string
          id_tiny?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          rg?: string | null
          site?: string | null
          situacao?: Database["public"]["Enums"]["situacao_fornecedor_enum"]
          telefone?: string | null
          tipo_negocio?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa_enum"] | null
          uf?: string | null
        }
        Update: {
          atualizado_em?: string
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_fornecedor?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_atualizacao_tiny?: string | null
          data_cadastro_tiny?: string | null
          email?: string | null
          email_nfe?: string | null
          endereco?: string | null
          fantasia?: string | null
          id?: string
          id_tiny?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          rg?: string | null
          site?: string | null
          situacao?: Database["public"]["Enums"]["situacao_fornecedor_enum"]
          telefone?: string | null
          tipo_negocio?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa_enum"] | null
          uf?: string | null
        }
        Relationships: []
      }
      imagens_modelo_produto: {
        Row: {
          caminho_arquivo: string | null
          criado_em: string
          hash_arquivo: string | null
          id: string
          id_modelo_produto: string
          imagem_principal: boolean
          ordem_exibicao: number
          tipo_origem: Database["public"]["Enums"]["tipo_origem_imagem_enum"]
          url_origem: string | null
        }
        Insert: {
          caminho_arquivo?: string | null
          criado_em?: string
          hash_arquivo?: string | null
          id?: string
          id_modelo_produto: string
          imagem_principal?: boolean
          ordem_exibicao?: number
          tipo_origem?: Database["public"]["Enums"]["tipo_origem_imagem_enum"]
          url_origem?: string | null
        }
        Update: {
          caminho_arquivo?: string | null
          criado_em?: string
          hash_arquivo?: string | null
          id?: string
          id_modelo_produto?: string
          imagem_principal?: boolean
          ordem_exibicao?: number
          tipo_origem?: Database["public"]["Enums"]["tipo_origem_imagem_enum"]
          url_origem?: string | null
        }
        Relationships: []
      }
      itens_estoque: {
        Row: {
          atualizado_em: string
          cambio_compra_para_real: number | null
          codigo_fabricante: string | null
          codigo_produto_fornecedor: string | null
          criado_em: string
          dados_tiny: Json | null
          data_cadastro_tiny: string | null
          data_compra: string | null
          id: string
          id_fornecedor: string | null
          id_local_estoque: string | null
          id_modelo_produto: string
          id_tiny: string | null
          moeda_compra: string | null
          nome_completo: string
          numeracao_br: number | null
          numeracao_eu: number | null
          numeracao_us: number | null
          observacoes: string | null
          sistema_numeracao: Database["public"]["Enums"]["sistema_numeracao_enum"]
          sku: string
          status_item: Database["public"]["Enums"]["status_item_enum"]
          valor_pago_euro: number | null
          valor_pago_original: number | null
          valor_pago_real: number | null
        }
        Insert: {
          atualizado_em?: string
          cambio_compra_para_real?: number | null
          codigo_fabricante?: string | null
          codigo_produto_fornecedor?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_cadastro_tiny?: string | null
          data_compra?: string | null
          id?: string
          id_fornecedor?: string | null
          id_local_estoque?: string | null
          id_modelo_produto: string
          id_tiny?: string | null
          moeda_compra?: string | null
          nome_completo: string
          numeracao_br?: number | null
          numeracao_eu?: number | null
          numeracao_us?: number | null
          observacoes?: string | null
          sistema_numeracao?: Database["public"]["Enums"]["sistema_numeracao_enum"]
          sku: string
          status_item?: Database["public"]["Enums"]["status_item_enum"]
          valor_pago_euro?: number | null
          valor_pago_original?: number | null
          valor_pago_real?: number | null
        }
        Update: {
          atualizado_em?: string
          cambio_compra_para_real?: number | null
          codigo_fabricante?: string | null
          codigo_produto_fornecedor?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_cadastro_tiny?: string | null
          data_compra?: string | null
          id?: string
          id_fornecedor?: string | null
          id_local_estoque?: string | null
          id_modelo_produto?: string
          id_tiny?: string | null
          moeda_compra?: string | null
          nome_completo?: string
          numeracao_br?: number | null
          numeracao_eu?: number | null
          numeracao_us?: number | null
          observacoes?: string | null
          sistema_numeracao?: Database["public"]["Enums"]["sistema_numeracao_enum"]
          sku?: string
          status_item?: Database["public"]["Enums"]["status_item_enum"]
          valor_pago_euro?: number | null
          valor_pago_original?: number | null
          valor_pago_real?: number | null
        }
        Relationships: []
      }
      itens_venda: {
        Row: {
          cambio_utilizado: number | null
          criado_em: string
          id: string
          id_item_estoque: string
          id_venda: string
          lucro_euro: number | null
          lucro_real: number | null
          moeda_venda: string
          valor_venda_euro: number | null
          valor_venda_original: number
          valor_venda_real: number | null
        }
        Insert: {
          cambio_utilizado?: number | null
          criado_em?: string
          id?: string
          id_item_estoque: string
          id_venda: string
          lucro_euro?: number | null
          lucro_real?: number | null
          moeda_venda: string
          valor_venda_euro?: number | null
          valor_venda_original: number
          valor_venda_real?: number | null
        }
        Update: {
          cambio_utilizado?: number | null
          criado_em?: string
          id?: string
          id_item_estoque?: string
          id_venda?: string
          lucro_euro?: number | null
          lucro_real?: number | null
          moeda_venda?: string
          valor_venda_euro?: number | null
          valor_venda_original?: number
          valor_venda_real?: number | null
        }
        Relationships: []
      }
      locais_estoque: {
        Row: {
          ativo: boolean
          codigo: string
          criado_em: string
          id: string
          nome: string
          pais: string | null
          tipo_regiao: Database["public"]["Enums"]["tipo_regiao_enum"]
        }
        Insert: {
          ativo?: boolean
          codigo: string
          criado_em?: string
          id?: string
          nome: string
          pais?: string | null
          tipo_regiao?: Database["public"]["Enums"]["tipo_regiao_enum"]
        }
        Update: {
          ativo?: boolean
          codigo?: string
          criado_em?: string
          id?: string
          nome?: string
          pais?: string | null
          tipo_regiao?: Database["public"]["Enums"]["tipo_regiao_enum"]
        }
        Relationships: []
      }
      logs_sincronizacao_tiny: {
        Row: {
          endpoint_tiny: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          mensagem_erro: string | null
          pagina: number | null
          quantidade_atualizada: number
          quantidade_criada: number
          quantidade_recebida: number
          resposta_bruta: Json | null
          status: Database["public"]["Enums"]["status_sincronizacao_enum"]
          tipo_sincronizacao: Database["public"]["Enums"]["tipo_sincronizacao_tiny_enum"]
        }
        Insert: {
          endpoint_tiny?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          mensagem_erro?: string | null
          pagina?: number | null
          quantidade_atualizada?: number
          quantidade_criada?: number
          quantidade_recebida?: number
          resposta_bruta?: Json | null
          status?: Database["public"]["Enums"]["status_sincronizacao_enum"]
          tipo_sincronizacao: Database["public"]["Enums"]["tipo_sincronizacao_tiny_enum"]
        }
        Update: {
          endpoint_tiny?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          mensagem_erro?: string | null
          pagina?: number | null
          quantidade_atualizada?: number
          quantidade_criada?: number
          quantidade_recebida?: number
          resposta_bruta?: Json | null
          status?: Database["public"]["Enums"]["status_sincronizacao_enum"]
          tipo_sincronizacao?: Database["public"]["Enums"]["tipo_sincronizacao_tiny_enum"]
        }
        Relationships: []
      }
      marcas: {
        Row: { criado_em: string; id: string; nome: string }
        Insert: { criado_em?: string; id?: string; nome: string }
        Update: { criado_em?: string; id?: string; nome?: string }
        Relationships: []
      }
      modelos_produto: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo_fabricante: string | null
          codigo_referencia: string | null
          cor: string | null
          criado_em: string
          descricao: string | null
          genero: string | null
          id: string
          id_categoria: string | null
          id_marca: string | null
          id_tiny_pai: string | null
          nome_modelo: string
          origem_cadastro: Database["public"]["Enums"]["origem_cadastro_enum"]
          slug: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo_fabricante?: string | null
          codigo_referencia?: string | null
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          genero?: string | null
          id?: string
          id_categoria?: string | null
          id_marca?: string | null
          id_tiny_pai?: string | null
          nome_modelo: string
          origem_cadastro?: Database["public"]["Enums"]["origem_cadastro_enum"]
          slug: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo_fabricante?: string | null
          codigo_referencia?: string | null
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          genero?: string | null
          id?: string
          id_categoria?: string | null
          id_marca?: string | null
          id_tiny_pai?: string | null
          nome_modelo?: string
          origem_cadastro?: Database["public"]["Enums"]["origem_cadastro_enum"]
          slug?: string
        }
        Relationships: []
      }
      movimentacoes_estoque: {
        Row: {
          criado_em: string
          data_movimentacao: string
          id: string
          id_item_estoque: string
          id_local_destino: string | null
          id_local_origem: string | null
          id_venda: string | null
          metadados: Json | null
          observacoes: string | null
          tipo_movimentacao: Database["public"]["Enums"]["tipo_movimentacao_enum"]
        }
        Insert: {
          criado_em?: string
          data_movimentacao?: string
          id?: string
          id_item_estoque: string
          id_local_destino?: string | null
          id_local_origem?: string | null
          id_venda?: string | null
          metadados?: Json | null
          observacoes?: string | null
          tipo_movimentacao: Database["public"]["Enums"]["tipo_movimentacao_enum"]
        }
        Update: {
          criado_em?: string
          data_movimentacao?: string
          id?: string
          id_item_estoque?: string
          id_local_destino?: string | null
          id_local_origem?: string | null
          id_venda?: string | null
          metadados?: Json | null
          observacoes?: string | null
          tipo_movimentacao?: Database["public"]["Enums"]["tipo_movimentacao_enum"]
        }
        Relationships: []
      }
      vendas: {
        Row: {
          atualizado_em: string
          cambio_venda_para_euro: number | null
          cambio_venda_para_real: number | null
          canal_venda: Database["public"]["Enums"]["canal_venda_enum"] | null
          criado_em: string
          data_venda: string
          id: string
          id_cliente: string | null
          moeda_venda: string
          observacoes: string | null
          provedor_link_pagamento: string | null
          status_venda: Database["public"]["Enums"]["status_venda_enum"]
          url_link_pagamento: string | null
          valor_desconto: number
          valor_subtotal: number
          valor_total: number
        }
        Insert: {
          atualizado_em?: string
          cambio_venda_para_euro?: number | null
          cambio_venda_para_real?: number | null
          canal_venda?: Database["public"]["Enums"]["canal_venda_enum"] | null
          criado_em?: string
          data_venda?: string
          id?: string
          id_cliente?: string | null
          moeda_venda?: string
          observacoes?: string | null
          provedor_link_pagamento?: string | null
          status_venda?: Database["public"]["Enums"]["status_venda_enum"]
          url_link_pagamento?: string | null
          valor_desconto?: number
          valor_subtotal?: number
          valor_total?: number
        }
        Update: {
          atualizado_em?: string
          cambio_venda_para_euro?: number | null
          cambio_venda_para_real?: number | null
          canal_venda?: Database["public"]["Enums"]["canal_venda_enum"] | null
          criado_em?: string
          data_venda?: string
          id?: string
          id_cliente?: string | null
          moeda_venda?: string
          observacoes?: string | null
          provedor_link_pagamento?: string | null
          status_venda?: Database["public"]["Enums"]["status_venda_enum"]
          url_link_pagamento?: string | null
          valor_desconto?: number
          valor_subtotal?: number
          valor_total?: number
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      show_limit: { Args: Record<string, never>; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      canal_venda_enum:
        | "instagram"
        | "whatsapp"
        | "site"
        | "loja_fisica"
        | "marketplace"
        | "outro"
      origem_cadastro_enum: "manual" | "tiny" | "importacao_planilha" | "api"
      sistema_numeracao_enum: "br" | "eu" | "us" | "outro"
      situacao_fornecedor_enum: "ativo" | "inativo"
      status_item_enum:
        | "devolvido"
        | "em_estoque"
        | "em_processo_de_compra"
        | "fora_de_estoque"
        | "inativo"
        | "reservado"
        | "transferencia"
        | "vendido"
      status_sincronizacao_enum: "em_andamento" | "sucesso" | "erro" | "parcial"
      status_venda_enum: "pendente" | "paga" | "cancelada" | "devolvida"
      tipo_movimentacao_enum:
        | "entrada"
        | "importado_tiny"
        | "transferencia"
        | "reserva"
        | "venda"
        | "devolucao"
        | "cancelamento"
        | "ajuste"
        | "saida"
      tipo_origem_imagem_enum:
        | "tiny"
        | "upload_manual"
        | "google"
        | "dropbox"
        | "url_externa"
      tipo_pessoa_enum: "fisica" | "juridica"
      tipo_regiao_enum: "brasil" | "europa" | "outros"
      tipo_sincronizacao_tiny_enum:
        | "produtos_listagem"
        | "produto_detalhe"
        | "pedidos_listagem"
        | "pedido_detalhe"
        | "contatos_listagem"
        | "contato_detalhe"
        | "outro"
    }
    CompositeTypes: { [_ in never]: never }
  }
}
