import type { Database, Json } from "../../../tipos/database.js";
import type { DadosItemEstoqueParseados } from "../../tiny/tinyParser.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

export interface ReferenciasItem {
  idModeloProduto: string;
  idFornecedor: string | null;
  idLocalEstoque: string | null;
}

export type ResultadoUpsertItem = "criado" | "atualizado";

export async function upsertItemEstoquePorTiny(
  supabase: SupabaseAppClient,
  dados: DadosItemEstoqueParseados,
  refs: ReferenciasItem,
): Promise<{ id: string; resultado: ResultadoUpsertItem }> {
  const porIdTiny = await supabase
    .from("itens_estoque")
    .select("id")
    .eq("id_tiny", dados.idTiny)
    .maybeSingle();

  if (porIdTiny.error) throw porIdTiny.error;

  const payloadComum: Database["public"]["Tables"]["itens_estoque"]["Update"] = {
    id_modelo_produto: refs.idModeloProduto,
    id_fornecedor: refs.idFornecedor,
    id_local_estoque: refs.idLocalEstoque,
    sku: dados.sku,
    nome_completo: dados.nomeCompleto,
    codigo_fabricante: dados.codigoFabricante,
    codigo_produto_fornecedor: dados.codigoProdutoFornecedor,
    numeracao_br: dados.numeracaoBr,
    numeracao_eu: dados.numeracaoEu,
    numeracao_us: dados.numeracaoUs,
    sistema_numeracao: dados.sistemaNumeracao,
    valor_pago_original: dados.valorPagoOriginal,
    data_cadastro_tiny: dados.dataCadastroTiny,
    observacoes: dados.observacoes,
    dados_tiny: dados.dadosTiny as Json,
  };

  if (porIdTiny.data) {
    const atualizado = await supabase
      .from("itens_estoque")
      .update(payloadComum)
      .eq("id", porIdTiny.data.id)
      .select("id")
      .single();
    if (atualizado.error) throw atualizado.error;
    return { id: atualizado.data.id, resultado: "atualizado" };
  }

  const porSku = await supabase
    .from("itens_estoque")
    .select("id, id_tiny")
    .eq("sku", dados.sku)
    .maybeSingle();

  if (porSku.error) throw porSku.error;

  if (porSku.data) {
    const atualizado = await supabase
      .from("itens_estoque")
      .update({ ...payloadComum, id_tiny: dados.idTiny })
      .eq("id", porSku.data.id)
      .select("id")
      .single();
    if (atualizado.error) throw atualizado.error;
    return { id: atualizado.data.id, resultado: "atualizado" };
  }

  const inserido = await supabase
    .from("itens_estoque")
    .insert({
      ...payloadComum,
      id_tiny: dados.idTiny,
      id_modelo_produto: refs.idModeloProduto,
      sku: dados.sku,
      nome_completo: dados.nomeCompleto,
    })
    .select("id")
    .single();

  if (inserido.error) throw inserido.error;
  return { id: inserido.data.id, resultado: "criado" };
}

export interface ItemEstoqueIdTinyResumo {
  id: string;
  id_tiny: string;
  status_item: string;
}

/** Itens vinculados ao Tiny (paginação por offset). */
export async function listarItensComIdTiny(
  supabase: SupabaseAppClient,
  opcoes: { offset: number; limite: number },
): Promise<ItemEstoqueIdTinyResumo[]> {
  const r = await supabase
    .from("itens_estoque")
    .select("id, id_tiny, status_item")
    .not("id_tiny", "is", null)
    .order("id", { ascending: true })
    .range(opcoes.offset, opcoes.offset + opcoes.limite - 1);

  if (r.error) throw r.error;
  return (r.data ?? []) as ItemEstoqueIdTinyResumo[];
}
