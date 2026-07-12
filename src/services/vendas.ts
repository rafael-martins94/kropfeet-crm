import { supabase } from "../lib/supabase";
import type {
  EnderecoCliente,
  PaginationParams,
  ParcelaVenda,
  StatusVenda,
  TipoRegiao,
  Venda,
  VendaInsert,
  VendaUpdate,
} from "../types/entities";
import { calcularLucroVenda, resolverCustoItem, type CustoItemEstoque } from "../utils/custoItem";
import { atualizar, contar, deletar, inserir, obterPorId } from "./base";

export interface ItemVendaDetalhado {
  id: string;
  id_venda: string;
  id_item_estoque: string | null;
  id_produto_tiny: string | null;
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valor_unitario: number;
  criado_em: string;
  item_estoque?: {
    id: string;
    sku: string;
    nome_produto: string;
    numeracao_br: number | null;
    id_modelo_produto: string | null;
    id_ordem_compra: string | null;
    local?: { tipo_regiao: string | null } | null;
    ordem_compra?: {
      valor_custo: number;
      moeda_compra: string;
    } | null;
  } | null;
  custo?: CustoItemEstoque | null;
  lucroCalculado?: { lucroReal: number | null; lucroEuro: number | null };
}

export interface VendaDetalhada extends Venda {
  cliente?: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
    pais: string | null;
    enderecos?: Pick<EnderecoCliente, "cep" | "cidade" | "uf" | "principal">[];
  } | null;
  endereco_entrega?: EnderecoCliente | null;
  vendedor?: { id: string; nome: string } | null;
  forma_envio?: { id: string; nome: string } | null;
  /** Itens embutidos na listagem (resumo). */
  itens?: Array<{
    id: string;
    codigo: string | null;
    descricao: string | null;
    quantidade: number;
    valor_unitario: number;
    item_estoque?: {
      id: string;
      sku: string;
      nome_produto: string;
      id_modelo_produto: string | null;
    } | null;
  }> | null;
}

export type ParcelaVendaInput = {
  numero: number;
  data_vencimento: string | null;
  valor: number;
  forma_pagamento: string | null;
  meio_pagamento: string | null;
  dias?: number | null;
  obs?: string | null;
  pago: boolean;
};

export type ResumoFinanceiroVenda = {
  valorPago: number;
  totalParcelado: number;
  saldoDevedor: number;
};

/** `contareceber` = ainda nao pago; demais formas = pago. */
export function parcelaEstaPagaPorForma(forma: string | null | undefined): boolean {
  return (forma ?? "").trim().toLowerCase() !== "contareceber";
}

export function resumoFinanceiroVenda(
  valorTotal: number,
  parcelas: Array<{ valor: number; pago: boolean }>,
): ResumoFinanceiroVenda {
  const total = Number.isFinite(valorTotal) ? valorTotal : 0;
  const totalParcelado = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const valorPago = parcelas.reduce(
    (acc, p) => (p.pago ? acc + (Number(p.valor) || 0) : acc),
    0,
  );
  // Saldo = o que falta receber: total do pedido menos o ja pago.
  // Se ainda houver valor nao parcelado, ele tambem entra no saldo.
  const saldoDevedor = Math.max(0, total - valorPago);
  return {
    valorPago: Number(valorPago.toFixed(2)),
    totalParcelado: Number(totalParcelado.toFixed(2)),
    saldoDevedor: Number(saldoDevedor.toFixed(2)),
  };
}

export const vendasService = {
  obter: (id: string) => obterPorId("vendas", id),

  obterDetalhada: async (id: string): Promise<VendaDetalhada | null> => {
    const { data, error } = await supabase
      .from("vendas")
      .select(
        `*,
         cliente:clientes(
           id, nome, email, telefone, cpf_cnpj, pais,
           enderecos:enderecos_cliente(cep, cidade, uf, principal)
         ),
         endereco_entrega:enderecos_cliente(*),
         vendedor:vendedores(id, nome),
         forma_envio:formas_envio(id, nome)`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as VendaDetalhada | null;
  },
  criar: (dados: VendaInsert) => inserir("vendas", dados),
  atualizar: async (id: string, patch: VendaUpdate) => {
    const atualizada = await atualizar("vendas", id, patch);
    if (patch.status_venda !== undefined) {
      const { error } = await supabase.rpc("sincronizar_efeitos_venda", {
        p_id_venda: id,
      });
      if (error) throw error;
    }
    return atualizada;
  },
  deletar: (id: string) => deletar("vendas", id),

  contarPorRegiao: async (): Promise<Record<"brasil" | "europa", number>> => {
    const [brasil, europa] = await Promise.all([
      contar("vendas", { regiao_venda: "brasil" }),
      contar("vendas", { regiao_venda: "europa" }),
    ]);
    return { brasil, europa };
  },

  listarComRelacoes: async (
    params?: PaginationParams & {
      status?: StatusVenda | "";
      regiao?: TipoRegiao | "";
      marcador?: string;
      sku?: string;
      /** ISO YYYY-MM-DD — filtra data_pedido */
      dataDe?: string | null;
      dataAte?: string | null;
    },
  ) => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();
    const marcador = params?.marcador?.trim();
    const sku = params?.sku?.trim();
    const dataDe = params?.dataDe?.trim() || null;
    const dataAte = params?.dataAte?.trim() || null;

    let idsPorSku: string[] | null = null;
    if (sku) {
      const padrao = `%${sku.replace(/[%_]/g, "")}%`;
      const [porCodigo, porEstoque] = await Promise.all([
        supabase.from("itens_venda").select("id_venda").ilike("codigo", padrao),
        supabase
          .from("itens_venda")
          .select("id_venda, item_estoque:itens_estoque!inner(id)")
          .ilike("itens_estoque.sku", padrao),
      ]);
      if (porCodigo.error) throw porCodigo.error;
      if (porEstoque.error) throw porEstoque.error;

      idsPorSku = [
        ...new Set(
          [...(porCodigo.data ?? []), ...(porEstoque.data ?? [])]
            .map((row) => row.id_venda)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      if (idsPorSku.length === 0) {
        return { data: [] as VendaDetalhada[], total: 0, page, pageSize };
      }
    }

    let query = supabase
      .from("vendas")
      .select(
        `*,
         cliente:clientes(
           id, nome, email, telefone, cpf_cnpj, pais,
           enderecos:enderecos_cliente(cep, cidade, uf, principal)
         ),
         vendedor:vendedores(id, nome),
         forma_envio:formas_envio(id, nome),
         itens:itens_venda(
           id, codigo, descricao, quantidade, valor_unitario,
           item_estoque:itens_estoque(id, sku, nome_produto, id_modelo_produto)
         )`,
        { count: "exact" },
      );

    if (idsPorSku) {
      query = query.in("id", idsPorSku);
    }

    if (params?.status) {
      query = query.eq("status_venda", params.status);
    }

    if (params?.regiao) {
      query = query.eq("regiao_venda", params.regiao);
    }

    if (marcador) {
      const padrao = `%${marcador.replace(/[%_]/g, "")}%`;
      query = query.ilike("marcadores_texto", padrao);
    }

    if (termo) {
      const padrao = `%${termo.replace(/%/g, "")}%`;
      query = query.or(
        `numero.ilike.${padrao},nome_cliente.ilike.${padrao},codigo_rastreamento.ilike.${padrao}`,
      );
    }

    if (dataDe) {
      query = query.gte("data_pedido", `${dataDe}T00:00:00`);
    }
    if (dataAte) {
      query = query.lte("data_pedido", `${dataAte}T23:59:59.999`);
    }

    query = query.order(params?.orderBy ?? "data_pedido", {
      ascending: params?.ascending ?? false,
      nullsFirst: false,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as unknown as VendaDetalhada[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  /** Tags distintas usadas nas vendas (opcionalmente por região). */
  listarMarcadores: async (
    regiao?: TipoRegiao | "",
  ): Promise<Array<{ value: string; label: string; cor: string | null }>> => {
    let query = supabase
      .from("vendas")
      .select("marcadores")
      .not("marcadores", "is", null)
      .limit(3000);

    if (regiao) {
      query = query.eq("regiao_venda", regiao);
    }

    const { data, error } = await query;
    if (error) throw error;

    const porChave = new Map<string, { value: string; label: string; cor: string | null }>();
    for (const row of data ?? []) {
      const lista = Array.isArray(row.marcadores) ? row.marcadores : [];
      for (const bruto of lista) {
        if (!bruto || typeof bruto !== "object") continue;
        const m = bruto as { descricao?: unknown; cor?: unknown };
        const label = String(m.descricao ?? "").trim();
        if (!label) continue;
        const chave = label.toLowerCase();
        if (porChave.has(chave)) continue;
        porChave.set(chave, {
          value: label,
          label,
          cor: typeof m.cor === "string" && m.cor ? m.cor : null,
        });
      }
    }

    return [...porChave.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
    );
  },

  obterItens: async (idVenda: string): Promise<ItemVendaDetalhado[]> => {
    const { data, error } = await supabase
      .from("itens_venda")
      .select(
        `*,
         item_estoque:itens_estoque(
           id, sku, nome_produto, numeracao_br, id_modelo_produto, id_ordem_compra,
           local:locais_estoque!itens_estoque_id_local_estoque_fkey(tipo_regiao),
           ordem_compra:ordens_compra!itens_estoque_id_ordem_compra_fkey(
             valor_custo, moeda_compra
           )
         )`,
      )
      .eq("id_venda", idVenda)
      .order("criado_em", { ascending: true });
    if (error) throw error;

    return (data ?? []).map((iv) => {
      const row = iv as unknown as ItemVendaDetalhado;
      const custo = resolverCustoItem(row.item_estoque ?? null);
      // Pedidos do Tiny sao em BRL: usa valor_unitario como valor de venda em real.
      const lucroCalculado = calcularLucroVenda(row.valor_unitario, null, custo);
      return { ...row, custo, lucroCalculado };
    });
  },

  /** Vendas que incluem o item de estoque (em geral 0 ou 1, por ser par único). */
  listarPorItemEstoque: async (
    idItemEstoque: string,
  ): Promise<
    Array<{
      id: string;
      numero: string | null;
      nome_cliente: string | null;
      status_venda: StatusVenda;
      regiao_venda: TipoRegiao;
      data_pedido: string | null;
      valor_total: number;
      moeda_venda: string | null;
      id_cliente: string | null;
      valor_unitario: number | null;
      cliente?: { id: string; nome: string } | null;
    }>
  > => {
    const { data, error } = await supabase
      .from("itens_venda")
      .select(
        `valor_unitario,
         venda:vendas!inner(
           id, numero, nome_cliente, status_venda, regiao_venda, data_pedido,
           valor_total, moeda_venda, id_cliente,
           cliente:clientes(id, nome)
         )`,
      )
      .eq("id_item_estoque", idItemEstoque)
      .order("criado_em", { ascending: false });
    if (error) throw error;

    return (data ?? []).flatMap((row) => {
      const venda = row.venda as unknown as {
        id: string;
        numero: string | null;
        nome_cliente: string | null;
        status_venda: StatusVenda;
        regiao_venda: TipoRegiao;
        data_pedido: string | null;
        valor_total: number;
        moeda_venda: string | null;
        id_cliente: string | null;
        cliente?: { id: string; nome: string } | null;
      } | null;
      if (!venda) return [];
      return [
        {
          id: venda.id,
          numero: venda.numero,
          nome_cliente: venda.nome_cliente,
          status_venda: venda.status_venda,
          regiao_venda: venda.regiao_venda,
          data_pedido: venda.data_pedido,
          valor_total: Number(venda.valor_total),
          moeda_venda: venda.moeda_venda,
          id_cliente: venda.id_cliente,
          valor_unitario: row.valor_unitario != null ? Number(row.valor_unitario) : null,
          cliente: venda.cliente ?? null,
        },
      ];
    });
  },

  /** Substitui todos os itens da venda pelos informados. */
  substituirItens: async (
    idVenda: string,
    itens: Array<{
      id_item_estoque: string | null;
      codigo?: string | null;
      descricao?: string | null;
      quantidade: number;
      valor_unitario: number;
    }>,
  ): Promise<void> => {
    const { data: anteriores, error: erroAnteriores } = await supabase
      .from("itens_venda")
      .select("id_item_estoque")
      .eq("id_venda", idVenda);
    if (erroAnteriores) throw erroAnteriores;

    const idsAnteriores = (anteriores ?? [])
      .map((row) => row.id_item_estoque)
      .filter((id): id is string => Boolean(id));

    const { error: erroRemocao } = await supabase
      .from("itens_venda")
      .delete()
      .eq("id_venda", idVenda);
    if (erroRemocao) throw erroRemocao;

    if (itens.length > 0) {
      const { error: erroInsercao } = await supabase.from("itens_venda").insert(
        itens.map((item) => ({
          id_venda: idVenda,
          id_item_estoque: item.id_item_estoque,
          codigo: item.codigo ?? null,
          descricao: item.descricao ?? null,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
        })),
      );
      if (erroInsercao) throw erroInsercao;
    }

    if (idsAnteriores.length > 0) {
      const { error: erroReverter } = await supabase.rpc("reverter_itens_removidos_venda", {
        p_id_venda: idVenda,
        p_ids_anteriores: idsAnteriores,
      });
      if (erroReverter) throw erroReverter;
    }

    const { error: erroSync } = await supabase.rpc("sincronizar_efeitos_venda", {
      p_id_venda: idVenda,
    });
    if (erroSync) throw erroSync;
  },

  obterParcelas: async (idVenda: string): Promise<ParcelaVenda[]> => {
    const { data, error } = await supabase
      .from("parcelas_venda")
      .select("*")
      .eq("id_venda", idVenda)
      .order("numero", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ParcelaVenda[];
  },

  atualizarParcela: async (
    idParcela: string,
    patch: { pago?: boolean; forma_pagamento?: string | null; meio_pagamento?: string | null },
  ): Promise<ParcelaVenda> => {
    const payload = { ...patch };
    if (payload.forma_pagamento !== undefined) {
      payload.pago = parcelaEstaPagaPorForma(payload.forma_pagamento);
    }
    const { data, error } = await supabase
      .from("parcelas_venda")
      .update(payload)
      .eq("id", idParcela)
      .select("*")
      .single();
    if (error) throw error;
    return data as ParcelaVenda;
  },

  /** Substitui todas as parcelas da venda pelas informadas. */
  substituirParcelas: async (
    idVenda: string,
    parcelas: ParcelaVendaInput[],
  ): Promise<void> => {
    const { error: erroRemocao } = await supabase
      .from("parcelas_venda")
      .delete()
      .eq("id_venda", idVenda);
    if (erroRemocao) throw erroRemocao;

    if (parcelas.length === 0) return;

    const { error: erroInsercao } = await supabase.from("parcelas_venda").insert(
      parcelas.map((p, idx) => {
        const forma = p.forma_pagamento ?? null;
        const pagoForcado = !parcelaEstaPagaPorForma(forma) ? false : p.pago;
        return {
          id_venda: idVenda,
          numero: p.numero || idx + 1,
          data_vencimento: p.data_vencimento,
          valor: p.valor,
          forma_pagamento: forma,
          meio_pagamento: p.meio_pagamento ?? null,
          dias: p.dias ?? null,
          obs: p.obs ?? null,
          pago: pagoForcado,
        };
      }),
    );
    if (erroInsercao) throw erroInsercao;
  },

  totalPorStatus: async (): Promise<Record<StatusVenda, number>> => {
    const statuses: StatusVenda[] = [
      "em_aberto",
      "pago",
      "preparando_envio",
      "enviado",
      "finalizado",
      "cancelado",
    ];
    const entradas = await Promise.all(
      statuses.map(async (s) => {
        const { count, error } = await supabase
          .from("vendas")
          .select("id", { count: "exact", head: true })
          .eq("status_venda", s);
        if (error) throw error;
        return [s, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entradas) as Record<StatusVenda, number>;
  },
};
