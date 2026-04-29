/**
 * Consulta o saldo no Tiny (produto.obter.estoque.php) e alinha o status_item no Supabase:
 * - saldo <= 0  -> fora_de_estoque (somente se estava em_estoque)
 * - saldo > 0   -> em_estoque (somente se estava fora_de_estoque)
 *
 * Não altera vendido, reservado, devolvido, em_processo_de_compra, transferência nem inativo.
 *
 * Pré-requisito: rodar no banco o SQL em db/migrations/20260417_add_status_item_fora_de_estoque.sql
 *
 * Uso:
 *   cd tools/tiny-sync && npm run sync:tiny:status-estoque
 *   npm run sync:tiny:status-estoque -- --dry-run
 *   npm run sync:tiny:status-estoque -- --limite=50
 *   npm run sync:tiny:status-estoque -- --id-tiny=760043469
 */
import type { SupabaseAppClient } from "../src/services/supabase/clienteSupabase.js";
import { env } from "../src/config/env.js";
import { obterEstoqueProdutoTiny } from "../src/services/tiny/clienteTiny.js";
import { TinyApiError } from "../src/services/tiny/tinyTipos.js";
import { obterClienteSupabase } from "../src/services/supabase/clienteSupabase.js";
import { listarItensComIdTiny } from "../src/services/supabase/repositorios/itensEstoque.js";
import {
  finalizarLogSync,
  iniciarLogSync,
} from "../src/services/supabase/repositorios/logsSincronizacao.js";
import { formatarErroDesconhecido } from "../src/utils/erro.js";
import { dormir } from "../src/utils/retry.js";
import { logger } from "../src/utils/logger.js";

const ENDPOINT = "/produto.obter.estoque.php";
const PAGE = 200;
/** Ondas extras (cada uma com pausa longa) se ainda vier bloqueio apos o retry interno do cliente Tiny. */
const ONDAS_EXTRAS_BLOQUEIO = 4;

function tinyIndicaBloqueioOuLimite(erro: unknown): boolean {
  return (
    erro instanceof TinyApiError &&
    (erro.codigoErro === "6" || erro.codigoErro === "30")
  );
}

function lerArgs(): { dryRun: boolean; limite: number | null; idTiny: string | null } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limite: number | null = null;
  let idTiny: string | null = null;
  for (const arg of args) {
    if (arg === "--dry-run") dryRun = true;
    const mLim = arg.match(/^--limite=(\d+)$/);
    if (mLim?.[1]) limite = Number.parseInt(mLim[1], 10);
    const mId = arg.match(/^--id-tiny=(.+)$/);
    if (mId?.[1]) idTiny = mId[1].trim();
  }
  return { dryRun, limite, idTiny };
}

function normalizarSaldo(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    const n = Number.parseFloat(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function decidirNovoStatus(
  saldo: number,
  statusAtual: string,
): "em_estoque" | "fora_de_estoque" | null {
  if (saldo > 0) {
    if (statusAtual === "fora_de_estoque") return "em_estoque";
    return null;
  }
  if (statusAtual === "em_estoque") return "fora_de_estoque";
  return null;
}

/** Texto curto entre parênteses no [X]. */
function detalheNaoAtualiza(saldo: number, statusCrm: string): string {
  if (saldo > 0 && statusCrm === "em_estoque") return "ja correta";
  if (saldo <= 0 && statusCrm === "fora_de_estoque") return "ja correta";
  if (saldo > 0) return "fluxo so fora->em";
  return "fluxo so em->fora";
}

async function processarItem(
  supabase: SupabaseAppClient,
  item: { id: string; id_tiny: string; status_item: string },
  dryRun: boolean,
): Promise<boolean> {
  const estoque = await obterEstoqueProdutoTiny(item.id_tiny);
  const saldo = normalizarSaldo(estoque.saldo);
  const novo = decidirNovoStatus(saldo, item.status_item);
  const tiny = item.id_tiny;

  if (!novo) {
    logger.info(
      `[X] tiny=${tiny} saldo=${saldo} crm=${item.status_item} (${detalheNaoAtualiza(saldo, item.status_item)})`,
    );
    return false;
  }

  if (dryRun) {
    logger.info(
      `[~] tiny=${tiny} saldo=${saldo} ${item.status_item}->${novo} (dry-run)`,
    );
    return true;
  }

  const upd = await supabase
    .from("itens_estoque")
    .update({ status_item: novo })
    .eq("id", item.id);
  if (upd.error) {
    throw new Error(formatarErroDesconhecido(upd.error));
  }
  logger.info(`[OK] tiny=${tiny} saldo=${saldo} ${item.status_item}->${novo}`);
  return true;
}

async function processarItemComResiliencia(
  supabase: SupabaseAppClient,
  item: { id: string; id_tiny: string; status_item: string },
  dryRun: boolean,
): Promise<boolean> {
  let ultimo: unknown;
  const maxOndas = 1 + ONDAS_EXTRAS_BLOQUEIO;
  for (let onda = 0; onda < maxOndas; onda += 1) {
    try {
      return await processarItem(supabase, item, dryRun);
    } catch (e) {
      ultimo = e;
      if (tinyIndicaBloqueioOuLimite(e) && onda < maxOndas - 1) {
        const extra = Math.min(180_000, 90_000 * (onda + 1));
        logger.warn("Tiny bloqueada/limite apos retentativas; pausa e repete o mesmo item", {
          id: item.id,
          idTiny: item.id_tiny,
          onda: onda + 1,
          maxOndas,
          extraMs: extra,
        });
        await dormir(extra);
        continue;
      }
      throw e;
    }
  }
  throw ultimo;
}

async function main(): Promise<void> {
  const { dryRun, limite, idTiny } = lerArgs();
  const supabase = obterClienteSupabase();
  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "outro",
    endpointTiny: ENDPOINT,
  });

  let recebidos = 0;
  let atualizados = 0;
  const erros: Array<{ id: string; idTiny: string; mensagem: string }> = [];

  try {
    if (idTiny) {
      recebidos = 1;
      const row = await supabase
        .from("itens_estoque")
        .select("id, id_tiny, status_item")
        .eq("id_tiny", idTiny)
        .maybeSingle();
      if (row.error) throw new Error(formatarErroDesconhecido(row.error));
      if (!row.data) {
        throw new Error(`Nenhum item no CRM com id_tiny=${idTiny}`);
      }
      const mudou = await processarItemComResiliencia(
        supabase,
        row.data as { id: string; id_tiny: string; status_item: string },
        dryRun,
      );
      if (mudou) atualizados += 1;
    } else {
      let offset = 0;
      while (true) {
        const lote = await listarItensComIdTiny(supabase, { offset, limite: PAGE });
        if (lote.length === 0) break;

        for (const item of lote) {
          if (limite !== null && recebidos >= limite) break;
          recebidos += 1;
          try {
            const mudou = await processarItemComResiliencia(supabase, item, dryRun);
            if (mudou) atualizados += 1;
          } catch (e) {
            const mensagem = formatarErroDesconhecido(e);
            erros.push({ id: item.id, idTiny: item.id_tiny, mensagem });
            logger.error("Falha ao consultar/atualizar item", {
              id: item.id,
              idTiny: item.id_tiny,
              mensagem,
            });
          }
          await dormir(env.tiny.delayMs);
        }

        if (limite !== null && recebidos >= limite) break;
        if (lote.length < PAGE) break;
        offset += PAGE;
      }
    }

    await finalizarLogSync(supabase, log.id, {
      status: erros.length === 0 ? "sucesso" : "parcial",
      quantidadeRecebida: recebidos,
      quantidadeAtualizada: atualizados,
      mensagemErro: erros.length > 0 ? JSON.stringify(erros.slice(0, 100)) : null,
    });

    logger.info("Sincronizacao status x estoque Tiny concluida", {
      dryRun,
      recebidos,
      atualizados,
      erros: erros.length,
    });
  } catch (erro) {
    const mensagem = formatarErroDesconhecido(erro);
    await finalizarLogSync(supabase, log.id, {
      status: "erro",
      quantidadeRecebida: recebidos,
      quantidadeAtualizada: atualizados,
      mensagemErro: mensagem,
    });
    throw erro;
  }
}

main().catch((erro: unknown) => {
  logger.error("Script falhou", {
    mensagem: formatarErroDesconhecido(erro),
  });
  process.exit(1);
});
