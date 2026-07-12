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
          codigo_tiny: string | null
          cpf_cnpj: string | null
          criado_em: string
          dados_tiny: Json | null
          email: string | null
          fantasia: string | null
          id: string
          id_tiny: string | null
          inscricao_estadual: string | null
          instagram: string | null
          nome: string
          observacoes: string | null
          pais: string | null
          rg: string | null
          telefone: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa_enum"] | null
        }
        Insert: {
          atualizado_em?: string
          codigo_tiny?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          email?: string | null
          fantasia?: string | null
          id?: string
          id_tiny?: string | null
          inscricao_estadual?: string | null
          instagram?: string | null
          nome: string
          observacoes?: string | null
          pais?: string | null
          rg?: string | null
          telefone?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa_enum"] | null
        }
        Update: {
          atualizado_em?: string
          codigo_tiny?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          email?: string | null
          fantasia?: string | null
          id?: string
          id_tiny?: string | null
          inscricao_estadual?: string | null
          instagram?: string | null
          nome?: string
          observacoes?: string | null
          pais?: string | null
          rg?: string | null
          telefone?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa_enum"] | null
        }
        Relationships: []
      }
      enderecos_cliente: {
        Row: {
          atualizado_em: string
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          criado_em: string
          endereco: string | null
          id: string
          id_cliente: string
          numero: string | null
          pais: string | null
          principal: boolean
          rotulo: string | null
          uf: string | null
        }
        Insert: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          criado_em?: string
          endereco?: string | null
          id?: string
          id_cliente: string
          numero?: string | null
          pais?: string | null
          principal?: boolean
          rotulo?: string | null
          uf?: string | null
        }
        Update: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          criado_em?: string
          endereco?: string | null
          id?: string
          id_cliente?: string
          numero?: string | null
          pais?: string | null
          principal?: boolean
          rotulo?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_cliente_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
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
      fornecedor_tiny_ids: {
        Row: {
          atualizado_em: string
          criado_em: string
          dados_tiny: Json | null
          id: string
          id_fornecedor: string
          id_tiny: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dados_tiny?: Json | null
          id?: string
          id_fornecedor: string
          id_tiny: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dados_tiny?: Json | null
          id?: string
          id_fornecedor?: string
          id_tiny?: string
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
          codigo_fornecedor: string | null
          criado_em: string
          dados_tiny: Json | null
          data_cadastro_tiny: string | null
          id: string
          id_fornecedor: string | null
          id_local_estoque: string | null
          id_modelo_produto: string
          id_ordem_compra: string | null
          id_tiny: string | null
          nome_produto: string
          numeracao_br: number | null
          numeracao_eu: number | null
          numeracao_us: string | null
          observacoes: string | null
          sistema_numeracao: Database["public"]["Enums"]["sistema_numeracao_enum"]
          sku: string
          status_item: Database["public"]["Enums"]["status_item_enum"]
        }
        Insert: {
          atualizado_em?: string
          codigo_fornecedor?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_cadastro_tiny?: string | null
          id?: string
          id_fornecedor?: string | null
          id_local_estoque?: string | null
          id_modelo_produto: string
          id_ordem_compra?: string | null
          id_tiny?: string | null
          nome_produto: string
          numeracao_br?: number | null
          numeracao_eu?: number | null
          numeracao_us?: string | null
          observacoes?: string | null
          sistema_numeracao?: Database["public"]["Enums"]["sistema_numeracao_enum"]
          sku: string
          status_item?: Database["public"]["Enums"]["status_item_enum"]
        }
        Update: {
          atualizado_em?: string
          codigo_fornecedor?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_cadastro_tiny?: string | null
          id?: string
          id_fornecedor?: string | null
          id_local_estoque?: string | null
          id_modelo_produto?: string
          id_ordem_compra?: string | null
          id_tiny?: string | null
          nome_produto?: string
          numeracao_br?: number | null
          numeracao_eu?: number | null
          numeracao_us?: string | null
          observacoes?: string | null
          sistema_numeracao?: Database["public"]["Enums"]["sistema_numeracao_enum"]
          sku?: string
          status_item?: Database["public"]["Enums"]["status_item_enum"]
        }
        Relationships: []
      }
      ordens_compra: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_compra: string
          id: string
          id_fornecedor: string | null
          id_item_estoque: string
          moeda_compra: string
          observacoes: string | null
          valor_custo: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_compra?: string
          id?: string
          id_fornecedor?: string | null
          id_item_estoque: string
          moeda_compra: string
          observacoes?: string | null
          valor_custo: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_compra?: string
          id?: string
          id_fornecedor?: string | null
          id_item_estoque?: string
          moeda_compra?: string
          observacoes?: string | null
          valor_custo?: number
        }
        Relationships: []
      }
      itens_venda: {
        Row: {
          criado_em: string
          codigo: string | null
          dados_tiny: Json | null
          descricao: string | null
          id: string
          id_item_estoque: string | null
          id_produto_tiny: string | null
          id_venda: string
          quantidade: number
          valor_unitario: number
        }
        Insert: {
          criado_em?: string
          codigo?: string | null
          dados_tiny?: Json | null
          descricao?: string | null
          id?: string
          id_item_estoque?: string | null
          id_produto_tiny?: string | null
          id_venda: string
          quantidade?: number
          valor_unitario?: number
        }
        Update: {
          criado_em?: string
          codigo?: string | null
          dados_tiny?: Json | null
          descricao?: string | null
          id?: string
          id_item_estoque?: string | null
          id_produto_tiny?: string | null
          id_venda?: string
          quantidade?: number
          valor_unitario?: number
        }
        Relationships: []
      }
      parcelas_venda: {
        Row: {
          atualizado_em: string
          criado_em: string
          dados_tiny: Json | null
          data_vencimento: string | null
          dias: number | null
          forma_pagamento: string | null
          id: string
          id_venda: string
          meio_pagamento: string | null
          numero: number
          obs: string | null
          pago: boolean
          valor: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dados_tiny?: Json | null
          data_vencimento?: string | null
          dias?: number | null
          forma_pagamento?: string | null
          id?: string
          id_venda: string
          meio_pagamento?: string | null
          numero: number
          obs?: string | null
          pago?: boolean
          valor?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dados_tiny?: Json | null
          data_vencimento?: string | null
          dias?: number | null
          forma_pagamento?: string | null
          id?: string
          id_venda?: string
          meio_pagamento?: string | null
          numero?: number
          obs?: string | null
          pago?: boolean
          valor?: number
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
          codigo_fornecedor: string | null
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
          codigo_fornecedor?: string | null
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
          codigo_fornecedor?: string | null
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
      vendedores: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      formas_envio: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          atualizado_em: string
          codigo_rastreamento: string | null
          codigo_venda_adquirente: string | null
          criado_em: string
          dados_tiny: Json | null
          data_entrega: string | null
          data_envio: string | null
          data_faturamento: string | null
          data_pagamento_frete: string | null
          data_pedido: string | null
          data_prevista: string | null
          deposito: string | null
          forma_pagamento: string | null
          frete_status: Database["public"]["Enums"]["frete_status_enum"]
          id: string
          id_cliente: string | null
          id_endereco_cliente: string | null
          id_forma_envio: string | null
          id_tiny: string | null
          id_vendedor: string | null
          local_venda: Database["public"]["Enums"]["local_venda_enum"] | null
          marcadores: Json | null
          moeda_venda: string
          nome_cliente: string | null
          numero: string | null
          numero_ecommerce: string | null
          obs: string | null
          obs_interna: string | null
          outras_despesas: number
          regiao_venda: Database["public"]["Enums"]["tipo_regiao_enum"]
          situacao_tiny: string | null
          status_venda: Database["public"]["Enums"]["status_venda_enum"]
          total_produtos: number
          url_rastreamento: string | null
          valor_desconto: number
          valor_frete: number
          valor_total: number
        }
        Insert: {
          atualizado_em?: string
          codigo_rastreamento?: string | null
          codigo_venda_adquirente?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_entrega?: string | null
          data_envio?: string | null
          data_faturamento?: string | null
          data_pagamento_frete?: string | null
          data_pedido?: string | null
          data_prevista?: string | null
          deposito?: string | null
          forma_pagamento?: string | null
          frete_status?: Database["public"]["Enums"]["frete_status_enum"]
          id?: string
          id_cliente?: string | null
          id_endereco_cliente?: string | null
          id_forma_envio?: string | null
          id_tiny?: string | null
          id_vendedor?: string | null
          local_venda?: Database["public"]["Enums"]["local_venda_enum"] | null
          marcadores?: Json | null
          nome_cliente?: string | null
          numero?: string | null
          numero_ecommerce?: string | null
          obs?: string | null
          obs_interna?: string | null
          outras_despesas?: number
          regiao_venda?: Database["public"]["Enums"]["tipo_regiao_enum"]
          situacao_tiny?: string | null
          status_venda?: Database["public"]["Enums"]["status_venda_enum"]
          total_produtos?: number
          url_rastreamento?: string | null
          valor_desconto?: number
          valor_frete?: number
          valor_total?: number
        }
        Update: {
          atualizado_em?: string
          codigo_rastreamento?: string | null
          codigo_venda_adquirente?: string | null
          criado_em?: string
          dados_tiny?: Json | null
          data_entrega?: string | null
          data_envio?: string | null
          data_faturamento?: string | null
          data_pagamento_frete?: string | null
          data_pedido?: string | null
          data_prevista?: string | null
          deposito?: string | null
          forma_pagamento?: string | null
          frete_status?: Database["public"]["Enums"]["frete_status_enum"]
          id?: string
          id_cliente?: string | null
          id_endereco_cliente?: string | null
          id_forma_envio?: string | null
          id_tiny?: string | null
          id_vendedor?: string | null
          local_venda?: Database["public"]["Enums"]["local_venda_enum"] | null
          marcadores?: Json | null
          nome_cliente?: string | null
          numero?: string | null
          numero_ecommerce?: string | null
          obs?: string | null
          obs_interna?: string | null
          outras_despesas?: number
          regiao_venda?: Database["public"]["Enums"]["tipo_regiao_enum"]
          situacao_tiny?: string | null
          status_venda?: Database["public"]["Enums"]["status_venda_enum"]
          total_produtos?: number
          url_rastreamento?: string | null
          valor_desconto?: number
          valor_frete?: number
          valor_total?: number
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      show_limit: { Args: Record<string, never>; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      definir_contexto_historico_item: {
        Args: {
          p_origem?: string | null
          p_id_venda?: string | null
          p_id_usuario?: string | null
        }
        Returns: undefined
      }
      atualizar_status_item_estoque: {
        Args: {
          p_id_item: string
          p_status_novo: Database["public"]["Enums"]["status_item_enum"]
          p_origem?: string | null
          p_id_venda?: string | null
          p_id_usuario?: string | null
        }
        Returns: undefined
      }
      reverter_itens_removidos_venda: {
        Args: { p_id_venda: string; p_ids_anteriores: string[] }
        Returns: number
      }
      sincronizar_efeitos_venda: {
        Args: { p_id_venda: string }
        Returns: Json
      }
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
      frete_status_enum: "nao_aplicavel" | "pendente" | "pago"
      local_venda_enum: "galeria" | "online"
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
      status_venda_enum:
        | "em_aberto"
        | "pago"
        | "preparando_envio"
        | "enviado"
        | "finalizado"
        | "cancelado"
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
