import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type ContaSumup = "pt" | "br";

export const CONTAS_SUMUP: { valor: ContaSumup; rotulo: string; moeda: string }[] = [
  { valor: "pt", rotulo: "SumUp Portugal", moeda: "EUR" },
  { valor: "br", rotulo: "SumUp Brasil", moeda: "BRL" },
];

export type VendaSumup = {
  id: string;
  codigo: string | null;
  valor: number;
  moeda: string;
  data: string;
  status: string;
  tipo: string | null;
  tipoPagamento: string | null;
  cartao: string | null;
  parcelas: number | null;
  descricao: string | null;
  valorEstornado: number | null;
  usuario: string | null;
  dataRepasse: string | null;
  payoutPlan?: string | null;
  payoutsTotal?: number | null;
  payoutsRecebidos?: number | null;
};

export type RecebivelSumup = {
  id: string;
  tipo: string;
  status: string | null;
  parcela: number | null;
  valorLiquido: number | null;
  taxa: number | null;
  valorBruto: number | null;
  dataPrevista: string | null;
  dataPagamento: string | null;
};

export type RespostaVendasSumup = {
  merchantCode: string;
  truncado: boolean;
  itens: VendaSumup[];
};

export type FiltroVendasSumup = {
  conta?: ContaSumup;
  de: string;
  ate: string;
  status?: string;
};

export type ResultadoSincronizacaoSumup = {
  conta: ContaSumup;
  merchantCode?: string;
  truncado?: boolean;
  transacoes?: number;
  detalhadas?: number;
  restantes?: number;
  recebiveis?: number;
  falhas?: string[];
  conciliacao?: { transacoes: number; atualizadas: number; baixadas: number; divergentes: number };
  erro?: string;
};

export function extrairCodigosSumup(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const parte of texto.split(/[^A-Za-z0-9]+/)) {
    const codigo = parte.trim().toUpperCase();
    if (!/^T[A-Z0-9]{6,}$/.test(codigo) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    saida.push(codigo);
  }
  return saida;
}

class FuncaoIndisponivel extends Error {}

async function chamarFuncao<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("sumup", { body: corpo });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    const resposta = error.context as Response;
    const json = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
    if (resposta.status === 404 && !json?.mensagem) {
      throw new FuncaoIndisponivel("A função SumUp ainda não foi publicada no Supabase.");
    }
    throw new Error(json?.mensagem || "Não foi possível consultar a SumUp.");
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    throw new FuncaoIndisponivel("A função SumUp não respondeu.");
  }
  throw error;
}

/** Proxy do Vite (chaves do .env.local), usado enquanto a Edge Function não estiver publicada. */
async function chamarProxyLocal<T>(caminho: string, params: URLSearchParams): Promise<T> {
  const resposta = await fetch(`/api/sumup/${caminho}?${params.toString()}`);
  const corpo = (await resposta.json().catch(() => null)) as (T & { mensagem?: string }) | null;
  if (!resposta.ok || !corpo) {
    throw new Error(corpo?.mensagem || "Não foi possível consultar a SumUp.");
  }
  return corpo;
}

async function comFallback<T>(conta: ContaSumup, remoto: () => Promise<T>, local: () => Promise<T>) {
  try {
    return await remoto();
  } catch (erro) {
    if (erro instanceof FuncaoIndisponivel) return local();
    throw erro;
  }
}

export async function obterVendaSumupPorCodigo(
  codigo: string,
  conta: ContaSumup = "pt",
): Promise<{ item: VendaSumup | null; recebiveis: RecebivelSumup[] }> {
  const corpo = await comFallback(
    conta,
    () =>
      chamarFuncao<{ item?: VendaSumup | null; recebiveis?: RecebivelSumup[] }>({
        acao: "transacao",
        conta,
        codigo,
      }),
    () =>
      chamarProxyLocal<{ item?: VendaSumup | null; recebiveis?: RecebivelSumup[] }>(
        "transacao",
        new URLSearchParams({ codigo, conta }),
      ),
  );
  return {
    item: corpo.item ?? null,
    recebiveis: Array.isArray((corpo as { recebiveis?: unknown }).recebiveis)
      ? (corpo as { recebiveis: RecebivelSumup[] }).recebiveis
      : [],
  };
}

export async function listarVendasSumup(filtro: FiltroVendasSumup): Promise<RespostaVendasSumup> {
  const conta = filtro.conta ?? "pt";
  const corpo = await comFallback(
    conta,
    () =>
      chamarFuncao<Partial<RespostaVendasSumup>>({
        acao: "transacoes",
        conta,
        de: filtro.de,
        ate: filtro.ate,
        status: filtro.status,
      }),
    () => {
      const params = new URLSearchParams({ de: filtro.de, ate: filtro.ate, conta });
      if (filtro.status) params.set("status", filtro.status);
      return chamarProxyLocal<Partial<RespostaVendasSumup>>("transacoes", params);
    },
  );
  return {
    merchantCode: typeof corpo.merchantCode === "string" ? corpo.merchantCode : "",
    truncado: corpo.truncado === true,
    itens: Array.isArray(corpo.itens) ? corpo.itens : [],
  };
}

export async function sincronizarSumup(
  conta: ContaSumup,
  de: string,
  ate: string,
): Promise<ResultadoSincronizacaoSumup> {
  const corpo = await chamarFuncao<{ resultados?: ResultadoSincronizacaoSumup[] }>({
    acao: "sincronizar",
    conta,
    de,
    ate,
  }).catch((erro: unknown) => {
    if (erro instanceof FuncaoIndisponivel) {
      throw new Error(
        "A função SumUp ainda não foi publicada no Supabase. Publique-a e cadastre as chaves para sincronizar.",
      );
    }
    throw erro;
  });
  const resultado = corpo.resultados?.[0];
  if (!resultado) throw new Error("A SumUp não devolveu resultado.");
  if (resultado.erro) throw new Error(resultado.erro);
  return resultado;
}

export type SugestaoVinculoSumup = {
  id_transacao: string;
  codigo: string;
  valor: number;
  moeda: string;
  data: string;
  parcelas_sumup: number | null;
  id_venda: string;
  numero: string | null;
  cliente: string | null;
  data_pedido: string | null;
  parcelas_pedido: number;
};

export async function listarSugestoesVinculoSumup(
  conta: ContaSumup,
  de: string,
  ate: string,
): Promise<SugestaoVinculoSumup[]> {
  const { data, error } = await supabase.rpc("sugestoes_vinculo_sumup", {
    p_conta: conta,
    p_de: de,
    p_ate: ate,
  });
  if (error) throw error;
  return (data ?? []) as SugestaoVinculoSumup[];
}

export async function vincularTransacaoSumup(idTransacao: string, idVenda: string): Promise<void> {
  const { error } = await supabase.rpc("vincular_transacao_sumup", {
    p_id_transacao: idTransacao,
    p_id_venda: idVenda,
  });
  if (error) throw error;
}

export type LinkPagamentoSumup = {
  id: string;
  url: string;
  valor: number;
  moeda: string;
};

function normalizarLinkPagamento(corpo: Partial<LinkPagamentoSumup> | null): LinkPagamentoSumup {
  const id = typeof corpo?.id === "string" ? corpo.id.trim() : "";
  const url = typeof corpo?.url === "string" ? corpo.url.trim() : "";
  const valor = typeof corpo?.valor === "number" ? corpo.valor : Number(corpo?.valor);
  const moeda = typeof corpo?.moeda === "string" ? corpo.moeda.trim().toUpperCase() : "";
  if (!id || !url.startsWith("https://") || !Number.isFinite(valor) || valor <= 0 || (moeda !== "BRL" && moeda !== "EUR")) {
    throw new Error("A SumUp não devolveu o link de pagamento.");
  }
  return { id, url, valor, moeda };
}

async function chamarProxyPost<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`/api/sumup/${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const json = (await resposta.json().catch(() => null)) as (T & { mensagem?: string }) | null;
  if (!resposta.ok || !json) {
    throw new Error(json?.mensagem || "Não foi possível criar o link da SumUp.");
  }
  return json;
}

export async function criarLinkPagamentoSumup(params: {
  conta: ContaSumup;
  valor: number;
  descricao: string;
  pedido: {
    nome: string;
    telefone: string;
    email: string | null;
    pais: string | null;
    observacao: string | null;
    itens: Array<{ id: string; sku: string; numeracao: string; preco: string | null }>;
    id_cliente: string;
    id_vendedor: string | null;
    id_carrinho: string;
  };
}): Promise<LinkPagamentoSumup> {
  const corpo = {
    acao: "checkout",
    conta: params.conta,
    valor: params.valor,
    descricao: params.descricao,
  };
  const criar = async () => {
    if (import.meta.env.DEV) {
      try {
        return normalizarLinkPagamento(await chamarFuncao<Partial<LinkPagamentoSumup>>(corpo));
      } catch {
        return normalizarLinkPagamento(
          await chamarProxyPost<Partial<LinkPagamentoSumup>>("checkout", {
            conta: params.conta,
            valor: params.valor,
            descricao: params.descricao,
          }),
        );
      }
    }
    return normalizarLinkPagamento(await chamarFuncao<Partial<LinkPagamentoSumup>>(corpo));
  };

  const link = await criar();
  const { error } = await supabase.rpc("registrar_checkout_sumup", {
    p_id_checkout: link.id,
    p_conta: params.conta,
    p_valor: link.valor,
    p_moeda: link.moeda,
    p_url: link.url,
    p_pedido: params.pedido,
  });
  if (error) throw error;
  return link;
}

export async function conciliarRecebiveisSumup(codigos: string[]): Promise<void> {
  if (codigos.length === 0) return;
  const { error } = await supabase.rpc("conciliar_recebiveis_sumup", { p_codigos: codigos });
  if (error) throw error;
}
