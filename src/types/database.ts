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
      conferencias: {
        Row: {
          criado_em: string
          fechado_em: string | null
          id: string
          id_usuario: string
          nome: string
          status: Database["public"]["Enums"]["status_conferencia_enum"]
        }
        Insert: {
          criado_em?: string
          fechado_em?: string | null
          id?: string
          id_usuario: string
          nome: string
          status?: Database["public"]["Enums"]["status_conferencia_enum"]
        }
        Update: {
          criado_em?: string
          fechado_em?: string | null
          id?: string
          id_usuario?: string
          nome?: string
          status?: Database["public"]["Enums"]["status_conferencia_enum"]
        }
        Relationships: []
      }
      conferencias_estoque: {
        Row: {
          conferido_em: string
          criado_em: string
          data_conferencia: string
          id: string
          id_conferencia: string | null
          id_item_estoque: string
          id_local_estoque: string | null
          id_usuario: string
          status_item_anterior: Database["public"]["Enums"]["status_item_enum"] | null
        }
        Insert: {
          conferido_em?: string
          criado_em?: string
          data_conferencia?: string
          id?: string
          id_conferencia?: string | null
          id_item_estoque: string
          id_local_estoque?: string | null
          id_usuario: string
          status_item_anterior?: Database["public"]["Enums"]["status_item_enum"] | null
        }
        Update: {
          conferido_em?: string
          criado_em?: string
          data_conferencia?: string
          id?: string
          id_conferencia?: string | null
          id_item_estoque?: string
          id_local_estoque?: string | null
          id_usuario?: string
          status_item_anterior?: Database["public"]["Enums"]["status_item_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "conferencias_estoque_id_conferencia_fkey"
            columns: ["id_conferencia"]
            isOneToOne: false
            referencedRelation: "conferencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_estoque_id_item_estoque_fkey"
            columns: ["id_item_estoque"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_estoque_id_local_estoque_fkey"
            columns: ["id_local_estoque"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
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
          moeda_venda: string | null
          nome_produto: string
          numeracao_br: number | null
          numeracao_eu: number | null
          numeracao_us: string | null
          observacoes: string | null
          ordem_em_estoque_primeiro: number
          preco_venda: number | null
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
          moeda_venda?: string | null
          nome_produto: string
          numeracao_br?: number | null
          numeracao_eu?: number | null
          numeracao_us?: string | null
          observacoes?: string | null
          preco_venda?: number | null
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
          moeda_venda?: string | null
          nome_produto?: string
          numeracao_br?: number | null
          numeracao_eu?: number | null
          numeracao_us?: string | null
          observacoes?: string | null
          preco_venda?: number | null
          sistema_numeracao?: Database["public"]["Enums"]["sistema_numeracao_enum"]
          sku?: string
          status_item?: Database["public"]["Enums"]["status_item_enum"]
        }
        Relationships: []
      }
      itens_estoque_ordem_compra_excecoes: {
        Row: {
          criado_em: string
          descricao_complementar: string | null
          id_item_estoque: string
          id_tiny: string | null
          motivo: string
          nome_produto: string
          sku: string
        }
        Insert: {
          criado_em?: string
          descricao_complementar?: string | null
          id_item_estoque: string
          id_tiny?: string | null
          motivo: string
          nome_produto: string
          sku: string
        }
        Update: {
          criado_em?: string
          descricao_complementar?: string | null
          id_item_estoque?: string
          id_tiny?: string | null
          motivo?: string
          nome_produto?: string
          sku?: string
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
      vitrine_destinos_saida: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          id_item_estoque: string
          id_local_destino: string
          id_vitrine: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          id_item_estoque: string
          id_local_destino: string
          id_vitrine: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          id_item_estoque?: string
          id_local_destino?: string
          id_vitrine?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_destinos_saida_id_item_estoque_fkey"
            columns: ["id_item_estoque"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_destinos_saida_id_local_destino_fkey"
            columns: ["id_local_destino"]
            isOneToOne: false
            referencedRelation: "locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_destinos_saida_id_vitrine_fkey"
            columns: ["id_vitrine"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrine_itens: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          id_item_estoque: string
          id_vitrine: string
          nome_exibicao: string | null
          numero_caixa: number | null
          ordem_selecao: number
          snapshot: Json | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          id_item_estoque: string
          id_vitrine: string
          nome_exibicao?: string | null
          numero_caixa?: number | null
          ordem_selecao?: number
          snapshot?: Json | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          id_item_estoque?: string
          id_vitrine?: string
          nome_exibicao?: string | null
          numero_caixa?: number | null
          ordem_selecao?: number
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_itens_id_item_estoque_fkey"
            columns: ["id_item_estoque"]
            isOneToOne: false
            referencedRelation: "itens_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_itens_id_vitrine_fkey"
            columns: ["id_vitrine"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrines: {
        Row: {
          atualizado_em: string
          criado_em: string
          encerrado_em: string | null
          estado_ui: Json
          etapa: Database["public"]["Enums"]["etapa_vitrine_enum"]
          id: string
          id_usuario: string
          publicado_em: string | null
          status: Database["public"]["Enums"]["status_vitrine_enum"]
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          encerrado_em?: string | null
          estado_ui?: Json
          etapa?: Database["public"]["Enums"]["etapa_vitrine_enum"]
          id?: string
          id_usuario: string
          publicado_em?: string | null
          status?: Database["public"]["Enums"]["status_vitrine_enum"]
          titulo: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          encerrado_em?: string | null
          estado_ui?: Json
          etapa?: Database["public"]["Enums"]["etapa_vitrine_enum"]
          id?: string
          id_usuario?: string
          publicado_em?: string | null
          status?: Database["public"]["Enums"]["status_vitrine_enum"]
          titulo?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      show_limit: { Args: Record<string, never>; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      categorias_contadores: {
        Args: { categoria_ids: string[] }
        Returns: { id: string; modelos: number; itens: number }[]
      }
      conferir_item_estoque: {
        Args: {
          p_id_conferencia: string
          p_id_item: string
          p_id_local?: string
        }
        Returns: string
      }
      criar_conferencia_estoque: { Args: { p_nome: string }; Returns: string }
      desfazer_conferencia_item: {
        Args: { p_id_conferencia: string; p_id_item: string }
        Returns: undefined
      }
      fechar_conferencia_estoque: {
        Args: { p_id_conferencia: string }
        Returns: undefined
      }
      criar_ordem_compra_com_item: {
        Args: {
          p_sku: string
          p_nome_produto: string
          p_id_modelo_produto: string
          p_id_local_estoque?: string
          p_codigo_fornecedor?: string
          p_numeracao_br?: number
          p_numeracao_eu?: number
          p_numeracao_us?: string
          p_sistema_numeracao?: Database["public"]["Enums"]["sistema_numeracao_enum"]
          p_status_item?: Database["public"]["Enums"]["status_item_enum"]
          p_observacoes_item?: string
          p_id_fornecedor?: string
          p_data_compra?: string
          p_moeda_compra?: string
          p_valor_custo?: number
          p_observacoes_ordem?: string
        }
        Returns: Json
      }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      publicar_vitrine: {
        Args: { p_id_usuario?: string; p_id_vitrine: string }
        Returns: Json
      }
      validar_itens_vitrine: {
        Args: { p_ids: string[] }
        Returns: { id_item: string; motivo: string | null; valido: boolean }[]
      }
      vitrines_contagem_modelo: {
        Args: { p_local_ids?: string[] | null; p_modelo_ids: string[] }
        Returns: { id_modelo_produto: string; total: number }[]
      }
      vitrines_id_local_vitrine: { Args: Record<string, never>; Returns: string | null }
    }
    Enums: {
      canal_venda_enum:
        | "instagram"
        | "whatsapp"
        | "site"
        | "loja_fisica"
        | "marketplace"
        | "outro"
      etapa_vitrine_enum:
        | "selecao"
        | "organizacao"
        | "correspondencias"
        | "destino_anterior"
        | "revisao"
      origem_cadastro_enum: "manual" | "tiny" | "importacao_planilha" | "api"
      sistema_numeracao_enum: "br" | "eu" | "us" | "outro"
      situacao_fornecedor_enum: "ativo" | "inativo"
      status_conferencia_enum: "aberta" | "fechada"
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
      status_vitrine_enum: "rascunho" | "publicada" | "encerrada"
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
