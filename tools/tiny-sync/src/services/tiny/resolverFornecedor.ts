import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { dormir } from "../../utils/retry.js";
import {
  upsertFornecedor,
  upsertFornecedorCompleto,
} from "../supabase/repositorios/fornecedores.js";
import type { SupabaseAppClient } from "../supabase/clienteSupabase.js";
import { obterContatoTiny } from "./clienteTiny.js";
import type { DadosFornecedorParseados } from "./tinyParser.js";
import { parseFornecedorTiny } from "./tinyParserContatos.js";
import { TinyApiError } from "./tinyTipos.js";

type IdFornecedor = string | null;

interface EntradaCache {
  idSupabase: IdFornecedor;
  enriquecido: boolean;
}

const cachePorIdTiny = new Map<string, EntradaCache>();

export function limparCacheResolverFornecedor(): void {
  cachePorIdTiny.clear();
}

async function buscarNoBanco(
  supabase: SupabaseAppClient,
  idTiny: string,
): Promise<{ id: string; enriquecido: boolean } | null> {
  const r = await supabase
    .from("fornecedores")
    .select("id, dados_tiny")
    .eq("id_tiny", idTiny)
    .maybeSingle();

  if (r.error) throw r.error;
  if (!r.data) return null;

  return {
    id: r.data.id,
    enriquecido: r.data.dados_tiny !== null,
  };
}

async function enriquecerViaTiny(
  supabase: SupabaseAppClient,
  idTiny: string,
): Promise<IdFornecedor> {
  await dormir(env.tiny.delayMs);
  const contato = await obterContatoTiny(idTiny);
  const parsed = parseFornecedorTiny(contato);
  const resultado = await upsertFornecedorCompleto(supabase, parsed);
  logger.info("Fornecedor enriquecido sob demanda", {
    idTiny,
    operacao: resultado.operacao,
    nome: parsed.nome,
  });
  return resultado.id;
}

export async function resolverFornecedorDoProduto(
  supabase: SupabaseAppClient,
  seed: DadosFornecedorParseados | null,
): Promise<IdFornecedor> {
  if (!seed) return null;

  const { idTiny } = seed;

  if (!idTiny) {
    if (!seed.nome) return null;
    return upsertFornecedor(supabase, seed);
  }

  const cached = cachePorIdTiny.get(idTiny);
  if (cached && cached.enriquecido) return cached.idSupabase;

  const doBanco = await buscarNoBanco(supabase, idTiny);
  if (doBanco?.enriquecido) {
    cachePorIdTiny.set(idTiny, { idSupabase: doBanco.id, enriquecido: true });
    return doBanco.id;
  }

  if (!env.tiny.enriquecerFornecedorSobDemanda) {
    const idSeed = await upsertFornecedor(supabase, seed);
    cachePorIdTiny.set(idTiny, { idSupabase: idSeed, enriquecido: false });
    return idSeed;
  }

  try {
    const idEnriquecido = await enriquecerViaTiny(supabase, idTiny);
    cachePorIdTiny.set(idTiny, { idSupabase: idEnriquecido, enriquecido: true });
    return idEnriquecido;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    logger.warn(
      "Nao foi possivel enriquecer fornecedor do Tiny, gravando apenas seed",
      {
        idTiny,
        mensagem,
        statusHttp: erro instanceof TinyApiError ? erro.status : null,
      },
    );
    const idSeed = await upsertFornecedor(supabase, seed);
    cachePorIdTiny.set(idTiny, { idSupabase: idSeed, enriquecido: false });
    return idSeed;
  }
}
