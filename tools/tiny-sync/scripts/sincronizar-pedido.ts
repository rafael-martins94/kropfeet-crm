/**
 * Sincroniza um unico pedido do Tiny pelo id_tiny.
 * Uso:
 *   npm run sync:tiny:pedido -- --id=755636753
 *   npm run sync:tiny:pedido -- --id=657900334 --regiao=europa
 */
import type { Database } from "../src/tipos/database.js";
import { sincronizarPedidoPorId } from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

type RegiaoVenda = Database["public"]["Enums"]["tipo_regiao_enum"];

function lerArgs(): { idTiny: string; regiaoVenda: RegiaoVenda } {
  const args = process.argv.slice(2);
  let idTiny: string | null = null;
  let regiaoVenda: RegiaoVenda = "brasil";

  for (const arg of args) {
    const mId = arg.match(/^--id=(.+)$/);
    if (mId?.[1]) idTiny = mId[1];

    const mReg = arg.match(/^--regiao=(brasil|europa|outros)$/);
    if (mReg?.[1]) regiaoVenda = mReg[1] as RegiaoVenda;
  }

  if (!idTiny) {
    throw new Error("Informe o id do Tiny com --id=<id>. Exemplo: --id=755636753");
  }

  return { idTiny, regiaoVenda };
}

async function main(): Promise<void> {
  const { idTiny, regiaoVenda } = lerArgs();
  const resultado = await sincronizarPedidoPorId(idTiny, regiaoVenda);
  logger.info("Resultado da sincronizacao individual de pedido", {
    idTiny,
    regiaoVenda,
    ...(resultado as unknown as Record<string, unknown>),
  });
  if (resultado.status === "erro") process.exit(1);
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao individual de pedido falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
