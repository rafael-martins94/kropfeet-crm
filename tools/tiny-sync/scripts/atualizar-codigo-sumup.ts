/**
 * Relê o pedido no Tiny e grava numero_ordem_compra em codigo_venda_adquirente.
 * Não regrava itens nem altera o estoque.
 *
 * Uso:
 *   npx tsx scripts/atualizar-codigo-sumup.ts
 *   npx tsx scripts/atualizar-codigo-sumup.ts --desde=2026-01-01
 */
import { env } from "../src/config/env.js";
import { obterClienteSupabase } from "../src/services/supabase/clienteSupabase.js";
import { obterPedidoTiny } from "../src/services/tiny/clienteTiny.js";
import { dormir } from "../src/utils/retry.js";

function argumentoDesde(): string | null {
  const arg = process.argv.slice(2).find((item) => item.startsWith("--desde="));
  return arg?.slice("--desde=".length).trim() || null;
}

async function main(): Promise<void> {
  const desde = argumentoDesde();
  const supabase = obterClienteSupabase();
  let consulta = supabase
    .from("vendas")
    .select("id, id_tiny, numero, codigo_venda_adquirente")
    .not("id_tiny", "is", null)
    .order("data_pedido", { ascending: false });
  if (desde) consulta = consulta.gte("data_pedido", desde);

  const lista = await consulta;
  if (lista.error) throw lista.error;

  const pedidos = lista.data ?? [];
  let atualizados = 0;
  let semCodigo = 0;
  let iguais = 0;
  let falhas = 0;

  for (const pedido of pedidos) {
    if (!pedido.id_tiny) continue;
    try {
      const detalhe = await obterPedidoTiny(pedido.id_tiny);
      const codigo = detalhe.numero_ordem_compra?.trim() || null;
      const atual = pedido.codigo_venda_adquirente?.trim() || null;
      if (!codigo) {
        semCodigo += 1;
      } else if (codigo === atual) {
        iguais += 1;
      } else {
        const gravado = await supabase
          .from("vendas")
          .update({ codigo_venda_adquirente: codigo })
          .eq("id", pedido.id);
        if (gravado.error) throw gravado.error;
        atualizados += 1;
        console.log(`${pedido.numero ?? pedido.id_tiny} -> ${codigo}`);
      }
    } catch (erro) {
      falhas += 1;
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error(`falha ${pedido.numero ?? pedido.id_tiny}: ${mensagem}`);
    }
    await dormir(env.tiny.delayMs);
  }

  console.log(
    JSON.stringify({ pedidos: pedidos.length, atualizados, iguais, semCodigo, falhas }),
  );
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : String(erro));
  process.exit(1);
});
