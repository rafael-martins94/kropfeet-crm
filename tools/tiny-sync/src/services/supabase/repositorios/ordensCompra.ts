import type { Database } from "../../../tipos/database.js";
import { normalizarTexto } from "../../../utils/normalizacao.js";
import type { DadosItemEstoqueParseados } from "../../tiny/tinyParser.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

type OrdemInsert = Database["public"]["Tables"]["ordens_compra"]["Insert"];
type OrdemUpdate = Database["public"]["Tables"]["ordens_compra"]["Update"];

interface CompraTinyParseada {
  moedaCompra: "EUR" | "BRL";
  valorCusto: number;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function textoDoCampo(dados: Record<string, unknown>, campo: string): string | null {
  const valor = dados[campo];
  return typeof valor === "string" || typeof valor === "number"
    ? normalizarTexto(String(valor))
    : null;
}

export function extrairCompraTinyDeDados(
  dadosTiny: Record<string, unknown>,
): CompraTinyParseada | null {
  const descricaoComplementar = textoDoCampo(dadosTiny, "descricao_complementar");
  if (!descricaoComplementar) return null;

  const match = descricaoComplementar.match(
    /(^|[^A-Za-z0-9])([ERer])\s*([0-9]+(?:[.,][0-9]+)?)(?:$|[^A-Za-z0-9])/,
  );
  if (!match?.[2] || !match[3]) return null;

  const valorCusto = Number(match[3].replace(",", "."));
  if (!Number.isFinite(valorCusto)) return null;

  const moedaCompra = match[2].toUpperCase() === "E" ? "EUR" : "BRL";

  return {
    moedaCompra,
    valorCusto,
  };
}

export async function upsertOrdemCompraTinyPorItem(
  supabase: SupabaseAppClient,
  idItemEstoque: string,
  dados: DadosItemEstoqueParseados,
  refs: { idFornecedor: string | null },
): Promise<string | null> {
  const compra = extrairCompraTinyDeDados(dados.dadosTiny);
  if (!compra) return null;

  const existente = await supabase
    .from("ordens_compra")
    .select("id")
    .eq("id_item_estoque", idItemEstoque)
    .maybeSingle();

  if (existente.error) throw existente.error;

  const payload: OrdemInsert & OrdemUpdate = {
    id_item_estoque: idItemEstoque,
    id_fornecedor: refs.idFornecedor,
    data_compra: hojeIso(),
    moeda_compra: compra.moedaCompra,
    valor_custo: compra.valorCusto,
    observacoes: "Criada automaticamente a partir de itens_estoque.dados_tiny",
  };

  const salvo = existente.data
    ? await supabase
        .from("ordens_compra")
        .update(payload)
        .eq("id", existente.data.id)
        .select("id")
        .single()
    : await supabase.from("ordens_compra").insert(payload).select("id").single();

  if (salvo.error) throw salvo.error;

  const vinculo = await supabase
    .from("itens_estoque")
    .update({ id_ordem_compra: salvo.data.id })
    .eq("id", idItemEstoque);

  if (vinculo.error) throw vinculo.error;

  return salvo.data.id;
}
