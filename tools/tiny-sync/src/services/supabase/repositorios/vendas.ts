import type { Database } from "../../../tipos/database.js";
import type {
  DadosItemVendaParseado,
  DadosParcelaVendaParseada,
  DadosVendaParseada,
} from "../../tiny/tinyParserPedidos.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

export type ResultadoUpsertVenda = "criado" | "atualizado";

type VendaUpsert = Database["public"]["Tables"]["vendas"]["Update"];

function montarPayloadVenda(
  dados: DadosVendaParseada,
  idCliente: string | null,
  idEnderecoCliente: string | null,
): VendaUpsert {
  return {
    numero: dados.numero,
    numero_ecommerce: dados.numeroEcommerce,
    id_cliente: idCliente,
    id_endereco_cliente: idEnderecoCliente,
    nome_cliente: dados.nomeCliente,
    regiao_venda: dados.regiaoVenda,
    data_pedido: dados.dataPedido,
    data_prevista: dados.dataPrevista,
    data_faturamento: dados.dataFaturamento,
    data_envio: dados.dataEnvio,
    data_entrega: dados.dataEntrega,
    status_venda: dados.statusVenda,
    situacao_tiny: dados.situacaoTiny,
    total_produtos: dados.totalProdutos,
    valor_frete: dados.valorFrete,
    valor_desconto: dados.valorDesconto,
    outras_despesas: dados.outrasDespesas,
    valor_total: dados.valorTotal,
    forma_pagamento: dados.formaPagamento,
    deposito: dados.deposito,
    codigo_rastreamento: dados.codigoRastreamento,
    url_rastreamento: dados.urlRastreamento,
    obs: dados.obs,
    obs_interna: dados.obsInterna,
    marcadores: dados.marcadores,
    dados_tiny: dados.dadosTiny,
  };
}

export async function upsertVendaPorTiny(
  supabase: SupabaseAppClient,
  dados: DadosVendaParseada,
  idCliente: string | null,
  idEnderecoCliente: string | null = null,
): Promise<{ id: string; resultado: ResultadoUpsertVenda }> {
  const payload = montarPayloadVenda(dados, idCliente, idEnderecoCliente);

  const existente = await supabase
    .from("vendas")
    .select("id")
    .eq("id_tiny", dados.idTiny)
    .maybeSingle();

  if (existente.error) throw existente.error;

  if (existente.data) {
    const atualizado = await supabase
      .from("vendas")
      .update(payload)
      .eq("id", existente.data.id)
      .select("id")
      .single();
    if (atualizado.error) throw atualizado.error;
    return { id: atualizado.data.id, resultado: "atualizado" };
  }

  const inserido = await supabase
    .from("vendas")
    .insert({ ...payload, id_tiny: dados.idTiny })
    .select("id")
    .single();

  if (inserido.error) throw inserido.error;
  return { id: inserido.data.id, resultado: "criado" };
}

async function resolverItemEstoque(
  supabase: SupabaseAppClient,
  item: DadosItemVendaParseado,
): Promise<string | null> {
  if (item.idProdutoTiny) {
    const porTiny = await supabase
      .from("itens_estoque")
      .select("id")
      .eq("id_tiny", item.idProdutoTiny)
      .limit(1)
      .maybeSingle();
    if (porTiny.error) throw porTiny.error;
    if (porTiny.data) return porTiny.data.id;
  }

  if (item.codigo) {
    const porSku = await supabase
      .from("itens_estoque")
      .select("id")
      .eq("sku", item.codigo)
      .limit(1)
      .maybeSingle();
    if (porSku.error) throw porSku.error;
    if (porSku.data) return porSku.data.id;
  }

  return null;
}

/** Substitui os itens da venda (remove os antigos e insere os do pedido atual). */
export async function substituirItensVenda(
  supabase: SupabaseAppClient,
  idVenda: string,
  itens: DadosItemVendaParseado[],
): Promise<void> {
  const remocao = await supabase.from("itens_venda").delete().eq("id_venda", idVenda);
  if (remocao.error) throw remocao.error;

  if (itens.length === 0) return;

  const linhas = [];
  for (const item of itens) {
    const idItemEstoque = await resolverItemEstoque(supabase, item);
    linhas.push({
      id_venda: idVenda,
      id_item_estoque: idItemEstoque,
      id_produto_tiny: item.idProdutoTiny,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valorUnitario,
      dados_tiny: item.dadosTiny,
    });
  }

  const insercao = await supabase.from("itens_venda").insert(linhas);
  if (insercao.error) throw insercao.error;
}

/** Substitui as parcelas da venda (remove as antigas e reaplica a regra Tiny de pago). */
export async function substituirParcelasVenda(
  supabase: SupabaseAppClient,
  idVenda: string,
  parcelas: DadosParcelaVendaParseada[],
): Promise<void> {
  const remocao = await supabase.from("parcelas_venda").delete().eq("id_venda", idVenda);
  if (remocao.error) throw remocao.error;

  if (parcelas.length === 0) return;

  const linhas = parcelas.map((p) => ({
    id_venda: idVenda,
    numero: p.numero,
    data_vencimento: p.dataVencimento,
    valor: p.valor,
    forma_pagamento: p.formaPagamento,
    meio_pagamento: p.meioPagamento,
    dias: p.dias,
    obs: p.obs,
    pago: p.pago,
    dados_tiny: p.dadosTiny,
  }));

  const insercao = await supabase.from("parcelas_venda").insert(linhas);
  if (insercao.error) throw insercao.error;
}
