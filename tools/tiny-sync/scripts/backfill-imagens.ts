/**
 * Backfill de imagens: percorre imagens_modelo_produto onde caminho_arquivo esta nulo,
 * baixa o binario da url_origem, faz upload no bucket e atualiza a linha.
 *
 * Uso:
 *   npm run backfill:imagens
 *   npm run backfill:imagens -- --limite=100
 */
import { obterClienteSupabase } from "../src/services/supabase/clienteSupabase.js";
import { baixarEArmazenarImagemDoModelo } from "../src/services/supabase/storageImagens.js";
import { logger } from "../src/utils/logger.js";
import { dormir } from "../src/utils/retry.js";

interface ArgsCli {
  limite: number | null;
  lote: number;
  delayMs: number;
}

function lerArgs(): ArgsCli {
  const args = process.argv.slice(2);
  let limite: number | null = null;
  let lote = 50;
  let delayMs = 300;

  for (const arg of args) {
    const mLim = arg.match(/^--limite=(\d+)$/);
    if (mLim?.[1]) limite = Number.parseInt(mLim[1], 10);

    const mLote = arg.match(/^--lote=(\d+)$/);
    if (mLote?.[1]) lote = Number.parseInt(mLote[1], 10);

    const mDelay = arg.match(/^--delay=(\d+)$/);
    if (mDelay?.[1]) delayMs = Number.parseInt(mDelay[1], 10);
  }

  return { limite, lote, delayMs };
}

async function main(): Promise<void> {
  const { limite, lote, delayMs } = lerArgs();
  const supabase = obterClienteSupabase();

  let totalProcessadas = 0;
  let totalSucesso = 0;
  let totalFalha = 0;
  let offset = 0;

  logger.info("Iniciando backfill de imagens", { limite, lote, delayMs });

  while (true) {
    const resto = limite !== null ? Math.max(0, limite - totalProcessadas) : Infinity;
    const tamanhoLote = Math.min(lote, Number.isFinite(resto) ? resto : lote);
    if (tamanhoLote <= 0) break;

    const consulta = await supabase
      .from("imagens_modelo_produto")
      .select("id, id_modelo_produto, url_origem")
      .is("caminho_arquivo", null)
      .not("url_origem", "is", null)
      .order("criado_em", { ascending: true })
      .range(offset, offset + tamanhoLote - 1);

    if (consulta.error) throw consulta.error;

    const registros = consulta.data ?? [];
    if (registros.length === 0) {
      logger.info("Nenhuma imagem restante para backfill");
      break;
    }

    for (const reg of registros) {
      if (!reg.url_origem) {
        continue;
      }
      totalProcessadas += 1;
      try {
        const gravada = await baixarEArmazenarImagemDoModelo(
          supabase,
          reg.url_origem,
          reg.id_modelo_produto,
        );

        const atualizado = await supabase
          .from("imagens_modelo_produto")
          .update({
            caminho_arquivo: gravada.caminhoArquivo,
            hash_arquivo: gravada.hashArquivo,
          })
          .eq("id", reg.id);

        if (atualizado.error) throw atualizado.error;
        totalSucesso += 1;
      } catch (erro) {
        totalFalha += 1;
        logger.error("Falha em imagem no backfill", {
          idImagem: reg.id,
          idModelo: reg.id_modelo_produto,
          url: reg.url_origem,
          mensagem: erro instanceof Error ? erro.message : String(erro),
        });
      }

      if (delayMs > 0) await dormir(delayMs);
    }

    offset += registros.length;

    logger.info("Lote concluido", {
      processadasNoLote: registros.length,
      totalProcessadas,
      totalSucesso,
      totalFalha,
    });

    if (limite !== null && totalProcessadas >= limite) break;
  }

  logger.info("Backfill finalizado", {
    totalProcessadas,
    totalSucesso,
    totalFalha,
  });

  if (totalFalha > 0) process.exit(1);
}

main().catch((erro: unknown) => {
  logger.error("Backfill falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
