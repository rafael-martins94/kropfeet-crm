// Edge Function: consulta a SumUp (Portugal e Brasil) e sincroniza transações e recebíveis.
// O checkout online manda return_url para esta função. A SumUp avisa com
// CHECKOUT_STATUS_CHANGED; o status só vale depois de reler o checkout na API.
// Secrets: SUMUP_PT_API_KEY, SUMUP_BR_API_KEY, SUMUP_CRON_TOKEN (agendamento) e, opcionais,
// SUMUP_PT_MERCHANT_CODE / SUMUP_BR_MERCHANT_CODE.
// verify_jwt fica desligado: a autorização (equipe do CRM ou token do agendamento) é feita aqui.
// O POST da SumUp não traz sessão; a confirmação é a releitura do checkout.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Conta = "pt" | "br";

type VendaSumup = {
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
  payoutPlan: string | null;
  payoutsTotal: number | null;
  payoutsRecebidos: number | null;
};

type RecebivelSumup = {
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

type Detalhe = {
  venda: VendaSumup | null;
  simpleStatus: string | null;
  recebiveis: RecebivelSumup[];
  dados: Record<string, unknown>;
};

const ORIGEM = "https://api.sumup.com";
const LIMITE_PAGINA = "100";
const MAX_PAGINAS = 40;
const MAX_DIAS = 366;
const MAX_DETALHES = 250;
const CONCORRENCIA = 4;

const FUSO: Record<Conta, string> = { pt: "Europe/Lisbon", br: "America/Sao_Paulo" };
const MOEDA_PADRAO: Record<Conta, string> = { pt: "EUR", br: "BRL" };

const STATUS_PERMITIDOS = new Set([
  "SUCCESSFUL",
  "CANCELLED",
  "FAILED",
  "PENDING",
  "REFUNDED",
  "CHARGE_BACK",
]);

const PARAMETROS_PROXIMA_PAGINA = new Set([
  "limit",
  "order",
  "oldest_time",
  "newest_time",
  "oldest_ref",
  "newest_ref",
  "statuses[]",
  "statuses",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class ErroConsulta extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const merchantEmCache = new Map<Conta, string>();

function responder(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "" && Number.isFinite(Number(valor))) {
    return Number(valor);
  }
  return null;
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor)
    ? valor.map(objeto).filter((v): v is Record<string, unknown> => v !== null)
    : [];
}

function sanitizar(mensagem: string): string {
  return mensagem.replace(/sup_sk_[A-Za-z0-9._-]+/g, "[chave]").slice(0, 300);
}

function dia(valor: unknown): string | null {
  const t = texto(valor);
  return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
}

function nomeConta(conta: Conta): string {
  return conta === "pt" ? "Portugal" : "Brasil";
}

function chaveDaConta(conta: Conta): string {
  const chave =
    conta === "pt"
      ? Deno.env.get("SUMUP_PT_API_KEY") ?? Deno.env.get("SUMUP_API_KEY")
      : Deno.env.get("SUMUP_BR_API_KEY");
  if (!chave?.trim()) {
    throw new ErroConsulta(
      `A chave da SumUp ${nomeConta(conta)} não está configurada (secret SUMUP_${conta.toUpperCase()}_API_KEY).`,
      503,
    );
  }
  return chave.trim();
}

/** Deslocamento do fuso em ms num instante (positivo a leste de UTC). */
function deslocamentoFuso(instante: number, fuso: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instante));
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const local = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return local - instante;
}

function inicioDoDiaIso(isoDia: string, fuso: string, somarDias = 0): string {
  const [a, m, d] = isoDia.split("-").map(Number);
  const utc = Date.UTC(a, m - 1, d + somarDias);
  const primeiro = utc - deslocamentoFuso(utc, fuso);
  return new Date(utc - deslocamentoFuso(primeiro, fuso)).toISOString();
}

function dataValida(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [a, m, d] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d
    ? valor
    : null;
}

async function lerErroSumup(resposta: Response): Promise<string> {
  const bruto = await resposta.text();
  try {
    const json = JSON.parse(bruto) as { detail?: unknown; message?: unknown; title?: unknown };
    const detalhe = texto(json.detail) ?? texto(json.message) ?? texto(json.title);
    if (detalhe) return sanitizar(detalhe);
  } catch {
    /* corpo não é JSON */
  }
  return `A SumUp respondeu com o status ${resposta.status}.`;
}

async function chamarSumup(conta: Conta, url: string, init?: RequestInit): Promise<Response> {
  const resposta = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${chaveDaConta(conta)}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (resposta.status === 401) {
    throw new ErroConsulta(`A chave da SumUp ${nomeConta(conta)} foi recusada.`, 401);
  }
  return resposta;
}

function lerValorCheckout(valor: unknown): number {
  const numeroValor = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor.replace(",", ".")) : NaN;
  if (!Number.isFinite(numeroValor) || numeroValor <= 0 || numeroValor > 999_999.99) {
    throw new ErroConsulta("Informe um valor válido.", 400);
  }
  return Math.round(numeroValor * 100) / 100;
}

function urlRetornoCheckout(): string {
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  if (!base.startsWith("https://")) {
    throw new ErroConsulta("A URL de retorno do pagamento não está configurada.", 500);
  }
  return `${base}/functions/v1/sumup`;
}

async function criarCheckout(
  conta: Conta,
  valor: number,
  descricao: string | null,
  idVenda: string | null,
) {
  const merchant = await obterMerchantCode(conta);
  const moeda = conta === "br" ? "BRL" : "EUR";
  const resposta = await chamarSumup(conta, `${ORIGEM}/v0.1/checkouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkout_reference: idVenda ?? crypto.randomUUID(),
      amount: valor,
      currency: moeda,
      merchant_code: merchant,
      description: (descricao ?? "Galeria KropCafé").slice(0, 140),
      return_url: urlRetornoCheckout(),
      hosted_checkout: { enabled: true },
    }),
  });
  if (resposta.status === 403) {
    throw new ErroConsulta(
      `A SumUp ${nomeConta(conta)} recusou o link. A chave precisa de permissão para criar pagamentos online.`,
      403,
    );
  }
  if (!resposta.ok) throw new ErroConsulta(await lerErroSumup(resposta), 502);
  const criado = objeto(await resposta.json());
  const url = texto(criado?.hosted_checkout_url);
  const id = texto(criado?.id);
  if (!url || !id) throw new ErroConsulta("A SumUp não devolveu o link de pagamento.", 502);
  return { id, url, valor, moeda };
}

async function lerCheckout(conta: Conta, id: string): Promise<Record<string, unknown> | null> {
  const resposta = await chamarSumup(conta, `${ORIGEM}/v0.1/checkouts/${encodeURIComponent(id)}`);
  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new ErroConsulta(await lerErroSumup(resposta), 502);
  return objeto(await resposta.json());
}

function transacaoConfirmada(checkout: Record<string, unknown>): { codigo: string } | null {
  const pagas = lista(checkout.transactions)
    .filter((item) => (texto(item.status) ?? "").toUpperCase() === "SUCCESSFUL" && texto(item.transaction_code))
    .sort((a, b) => (texto(b.timestamp) ?? "").localeCompare(texto(a.timestamp) ?? ""));
  const codigo = texto(pagas[0]?.transaction_code)?.toUpperCase() ?? null;
  if (!codigo || !/^T[A-Z0-9]{6,24}$/.test(codigo)) return null;
  return { codigo };
}

async function processarRetornoCheckout(admin: SupabaseClient, idCheckout: string): Promise<void> {
  const guardado = await admin
    .from("checkouts_sumup")
    .select("conta, id_venda")
    .eq("id_checkout", idCheckout)
    .maybeSingle();
  if (guardado.error) throw new ErroConsulta(guardado.error.message, 500);

  const contaGuardada = guardado.data?.conta === "pt" || guardado.data?.conta === "br" ? guardado.data.conta : null;
  const ordem = (contaGuardada ? [contaGuardada, contaGuardada === "pt" ? "br" : "pt"] : ["pt", "br"]) as Conta[];
  let conta: Conta | null = null;
  let checkout: Record<string, unknown> | null = null;
  for (const candidata of ordem) {
    checkout = await lerCheckout(candidata, idCheckout);
    if (checkout) {
      conta = candidata;
      break;
    }
  }
  if (!checkout || !conta) return;

  const status = (texto(checkout.status) ?? "PENDING").toUpperCase();
  const paga = status === "PAID" ? transacaoConfirmada(checkout) : null;
  if (status === "PAID" && !paga) {
    throw new ErroConsulta("O checkout está pago, mas a SumUp ainda não devolveu o código.", 502);
  }

  const linha: Record<string, unknown> = {
    id_checkout: idCheckout,
    conta,
    valor: numero(checkout.amount) ?? 0,
    moeda: texto(checkout.currency) ?? MOEDA_PADRAO[conta],
    status,
    atualizado_em: new Date().toISOString(),
  };
  const urlCheckout = texto(checkout.hosted_checkout_url);
  if (urlCheckout) linha.url = urlCheckout;
  if (paga) linha.codigo_transacao = paga.codigo;

  const { error } = await admin.from("checkouts_sumup").upsert(linha, { onConflict: "id_checkout" });
  if (error) throw new ErroConsulta(error.message, 500);
  if (!paga) return;

  try {
    const detalhe = await obterDetalhe(conta, "transaction_code", paga.codigo);
    if (detalhe) await gravarDetalhe(admin, conta, detalhe);
  } catch (erro) {
    console.error(
      "detalhe sumup",
      paga.codigo,
      erro instanceof Error ? sanitizar(erro.message) : "falha",
    );
  }

  const aplicado = await admin.rpc("aplicar_retorno_checkout_sumup", {
    p_id_checkout: idCheckout,
    p_status: status,
    p_codigo: paga.codigo,
    p_id_venda: guardado.data?.id_venda ?? null,
  });
  if (aplicado.error) throw new ErroConsulta(aplicado.error.message, 500);
}

async function obterMerchantCode(conta: Conta): Promise<string> {
  const configurado = Deno.env.get(`SUMUP_${conta.toUpperCase()}_MERCHANT_CODE`)?.trim();
  if (configurado) return configurado;
  const emCache = merchantEmCache.get(conta);
  if (emCache) return emCache;

  const resposta = await chamarSumup(conta, `${ORIGEM}/v0.1/me`);
  if (!resposta.ok) throw new ErroConsulta(await lerErroSumup(resposta), 502);
  const corpo = objeto(await resposta.json());
  const codigo = texto(corpo?.merchant_code) ?? texto(objeto(corpo?.merchant_profile)?.merchant_code);
  if (!codigo) {
    throw new ErroConsulta(
      `A SumUp não devolveu o código da conta ${nomeConta(conta)}. Configure SUMUP_${conta.toUpperCase()}_MERCHANT_CODE.`,
      502,
    );
  }
  merchantEmCache.set(conta, codigo);
  return codigo;
}

function normalizarVenda(bruto: unknown, conta: Conta, indice: number): VendaSumup | null {
  const item = objeto(bruto);
  if (!item) return null;
  const codigo = texto(item.transaction_code)?.toUpperCase() ?? null;
  const data = texto(item.timestamp);
  const id =
    texto(item.transaction_id) ??
    texto(item.id) ??
    (codigo && data ? `${codigo}-${data}` : `sumup-${conta}-${indice}`);
  const valor = numero(item.amount);
  if (valor === null || !data) return null;

  return {
    id,
    codigo,
    valor,
    moeda: texto(item.currency) ?? MOEDA_PADRAO[conta],
    data,
    status: texto(item.status) ?? "UNKNOWN",
    tipo: texto(item.type),
    tipoPagamento: texto(item.payment_type),
    cartao: texto(item.card_type) ?? texto(objeto(item.card)?.type),
    parcelas: numero(item.installments_count),
    descricao: texto(item.product_summary),
    valorEstornado: numero(item.refunded_amount),
    usuario: texto(item.user) ?? texto(item.username),
    dataRepasse: texto(item.payout_date),
    payoutPlan: texto(item.payout_plan),
    payoutsTotal: numero(item.payouts_total),
    payoutsRecebidos: numero(item.payouts_received),
  };
}

function parametrosDaProximaPagina(href: string): URLSearchParams | null {
  let origem: URLSearchParams;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (url.origin !== ORIGEM || !url.pathname.endsWith("/transactions/history")) return null;
    origem = url.searchParams;
  } else {
    origem = new URLSearchParams(href.startsWith("?") ? href.slice(1) : href);
  }
  const limpos = new URLSearchParams();
  for (const [chave, valor] of origem.entries()) {
    if (PARAMETROS_PROXIMA_PAGINA.has(chave)) limpos.append(chave, valor);
  }
  return [...limpos.keys()].length > 0 ? limpos : null;
}

async function listarHistorico(
  conta: Conta,
  de: string,
  ate: string,
  status: string | null,
): Promise<{ merchant: string; itens: VendaSumup[]; truncado: boolean }> {
  const merchant = await obterMerchantCode(conta);
  const base = `${ORIGEM}/v2.1/merchants/${encodeURIComponent(merchant)}/transactions/history`;
  let parametros = new URLSearchParams();
  parametros.set("limit", LIMITE_PAGINA);
  parametros.set("order", "descending");
  parametros.set("oldest_time", inicioDoDiaIso(de, FUSO[conta]));
  parametros.set("newest_time", inicioDoDiaIso(ate, FUSO[conta], 1));
  if (status) parametros.append("statuses[]", status);

  const itens: VendaSumup[] = [];
  let truncado = false;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const resposta = await chamarSumup(conta, `${base}?${parametros.toString()}`);
    if (!resposta.ok) throw new ErroConsulta(await lerErroSumup(resposta), 502);
    const corpo = objeto(await resposta.json());
    for (const item of lista(corpo?.items)) {
      const venda = normalizarVenda(item, conta, itens.length);
      if (venda) itens.push(venda);
    }
    const proximo = lista(corpo?.links).find((l) => l.rel === "next" && texto(l.href));
    const seguintes = proximo ? parametrosDaProximaPagina(String(proximo.href)) : null;
    if (!seguintes) break;
    if (pagina === MAX_PAGINAS - 1) {
      truncado = true;
      break;
    }
    parametros = seguintes;
  }
  return { merchant, itens, truncado };
}

/** `events` traz líquido e taxa; `transaction_events` traz data prevista e data paga. */
function extrairRecebiveis(conta: Conta, detalhe: Record<string, unknown>): RecebivelSumup[] {
  const eventos = lista(detalhe.events);
  const eventosTransacao = lista(detalhe.transaction_events);
  const usados = new Set<Record<string, unknown>>();

  const casar = (ev: Record<string, unknown>) => {
    const id = texto(String(ev.id ?? ""));
    const porId = id ? eventosTransacao.find((te) => String(te.id ?? "") === id) : undefined;
    const achado =
      porId ??
      eventosTransacao.find(
        (te) =>
          !usados.has(te) &&
          (texto(te.event_type) ?? texto(te.type)) === texto(ev.type) &&
          numero(te.installment_number) === numero(ev.installment_number),
      );
    if (achado) usados.add(achado);
    return achado;
  };

  const montar = (
    ev: Record<string, unknown> | null,
    te: Record<string, unknown> | undefined,
  ): RecebivelSumup | null => {
    const base = ev ?? te;
    if (!base) return null;
    const idBruto = texto(String(base.id ?? ""));
    const tipo = texto(ev?.type) ?? texto(te?.event_type) ?? texto(te?.type) ?? "DESCONHECIDO";
    const parcela = numero(ev?.installment_number) ?? numero(te?.installment_number);
    const status = texto(ev?.status) ?? texto(te?.status);
    const valorLiquido = numero(ev?.amount) ?? numero(te?.amount);
    const taxa = numero(ev?.fee_amount);
    const dataPrevista = dia(te?.due_date) ?? dia(te?.date) ?? dia(ev?.timestamp);
    const pago = status === "PAID_OUT";
    return {
      id: `${conta}-${idBruto ?? `${tipo}-${parcela ?? 0}`}`,
      tipo,
      status,
      parcela,
      valorLiquido,
      taxa,
      valorBruto: valorLiquido === null ? null : Math.round((valorLiquido + (taxa ?? 0)) * 100) / 100,
      dataPrevista,
      dataPagamento: pago ? dia(te?.date) ?? dia(ev?.timestamp) ?? dataPrevista : null,
    };
  };

  const saida: RecebivelSumup[] = [];
  for (const ev of eventos) {
    const r = montar(ev, casar(ev));
    if (r) saida.push(r);
  }
  for (const te of eventosTransacao) {
    if (usados.has(te)) continue;
    const r = montar(null, te);
    if (r) saida.push(r);
  }
  return saida;
}

async function obterDetalhe(conta: Conta, parametro: "id" | "transaction_code", valor: string): Promise<Detalhe | null> {
  const resposta = await chamarSumup(
    conta,
    `${ORIGEM}/v0.1/me/transactions?${parametro}=${encodeURIComponent(valor)}`,
  );
  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new ErroConsulta(await lerErroSumup(resposta), 502);
  const corpo = await resposta.json();
  const detalhe = objeto(Array.isArray(corpo) ? corpo[0] : corpo);
  if (!detalhe) return null;
  return {
    venda: normalizarVenda(detalhe, conta, 0),
    simpleStatus: texto(detalhe.simple_status),
    recebiveis: extrairRecebiveis(conta, detalhe),
    dados: {
      payout_plan: detalhe.payout_plan ?? null,
      payout_date: detalhe.payout_date ?? null,
      payouts_total: detalhe.payouts_total ?? null,
      payouts_received: detalhe.payouts_received ?? null,
      events: detalhe.events ?? [],
      transaction_events: detalhe.transaction_events ?? [],
    },
  };
}

function linhaTransacao(conta: Conta, v: VendaSumup) {
  return {
    id: v.id,
    conta,
    codigo: v.codigo,
    tipo: v.tipo,
    valor: v.valor,
    moeda: v.moeda,
    data: v.data,
    status: v.status,
    tipo_pagamento: v.tipoPagamento,
    cartao: v.cartao,
    parcelas: v.parcelas,
    payout_plan: v.payoutPlan,
    payouts_total: v.payoutsTotal,
    payouts_received: v.payoutsRecebidos,
    valor_estornado: v.valorEstornado,
    descricao: v.descricao,
    sincronizado_em: new Date().toISOString(),
  };
}

function precisaDetalhar(
  v: VendaSumup,
  anterior: { status: string | null; payouts_received: number | null; detalhado_em: string | null } | undefined,
): boolean {
  if (v.status === "FAILED" || v.status === "CANCELLED") return false;
  if (!anterior?.detalhado_em) return true;
  if (anterior.status !== v.status) return true;
  if ((anterior.payouts_received ?? -1) !== (v.payoutsRecebidos ?? -1)) return true;
  return (v.payoutsRecebidos ?? 0) < (v.payoutsTotal ?? 0);
}

async function emLotes<T>(itens: T[], tamanho: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn));
  }
}

async function sincronizar(admin: SupabaseClient, conta: Conta, de: string, ate: string) {
  const historico = await listarHistorico(conta, de, ate, null);
  const vendas = historico.itens;

  const anteriores = new Map<
    string,
    { status: string | null; payouts_received: number | null; detalhado_em: string | null }
  >();
  for (let i = 0; i < vendas.length; i += 200) {
    const ids = vendas.slice(i, i + 200).map((v) => v.id);
    const { data, error } = await admin
      .from("transacoes_sumup")
      .select("id, status, payouts_received, detalhado_em")
      .in("id", ids);
    if (error) throw error;
    for (const linha of data ?? []) anteriores.set(linha.id, linha);
  }

  const pendentes = vendas.filter((v) => precisaDetalhar(v, anteriores.get(v.id)));

  for (let i = 0; i < vendas.length; i += 200) {
    const { error } = await admin
      .from("transacoes_sumup")
      .upsert(vendas.slice(i, i + 200).map((v) => linhaTransacao(conta, v)), { onConflict: "id" });
    if (error) throw error;
  }

  const aDetalhar = pendentes.slice(0, MAX_DETALHES);
  let recebiveis = 0;
  const falhas: string[] = [];

  await emLotes(aDetalhar, CONCORRENCIA, async (v) => {
    try {
      const detalhe = await obterDetalhe(conta, "id", v.id);
      if (!detalhe) return;
      if (detalhe.recebiveis.length > 0) {
        const { error } = await admin.from("recebiveis_sumup").upsert(
          detalhe.recebiveis.map((r) => ({
            id: r.id,
            id_transacao: v.id,
            conta,
            codigo_transacao: v.codigo,
            tipo: r.tipo,
            status: r.status,
            parcela: r.parcela,
            valor_liquido: r.valorLiquido,
            taxa: r.taxa,
            moeda: v.moeda,
            data_prevista: r.dataPrevista,
            data_pagamento: r.dataPagamento,
            sincronizado_em: new Date().toISOString(),
          })),
          { onConflict: "id" },
        );
        if (error) throw error;
        recebiveis += detalhe.recebiveis.length;
      }
      const { error } = await admin
        .from("transacoes_sumup")
        .update({
          simple_status: detalhe.simpleStatus,
          dados: detalhe.dados,
          detalhado_em: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (error) throw error;
    } catch (erro) {
      falhas.push(`${v.codigo ?? v.id}: ${erro instanceof Error ? sanitizar(erro.message) : "falha"}`);
    }
  });

  const codigos = [...new Set(vendas.map((v) => v.codigo).filter((c): c is string => Boolean(c)))];
  let conciliacao: Record<string, number> = { transacoes: 0, atualizadas: 0, baixadas: 0, divergentes: 0 };
  for (let i = 0; i < codigos.length; i += 500) {
    const { data, error } = await admin.rpc("conciliar_recebiveis_sumup", {
      p_codigos: codigos.slice(i, i + 500),
    });
    if (error) throw error;
    const parcial = (data ?? {}) as Record<string, number>;
    conciliacao = Object.fromEntries(
      Object.keys(conciliacao).map((k) => [k, conciliacao[k] + Number(parcial[k] ?? 0)]),
    );
  }

  return {
    conta,
    merchantCode: historico.merchant,
    truncado: historico.truncado,
    transacoes: vendas.length,
    detalhadas: aDetalhar.length - falhas.length,
    restantes: Math.max(0, pendentes.length - aDetalhar.length),
    recebiveis,
    falhas: falhas.slice(0, 10),
    conciliacao,
  };
}

async function gravarDetalhe(
  admin: SupabaseClient,
  conta: Conta,
  detalhe: Detalhe,
): Promise<number> {
  const venda = detalhe.venda;
  if (!venda) return 0;
  const { error: erroVenda } = await admin
    .from("transacoes_sumup")
    .upsert(linhaTransacao(conta, venda), { onConflict: "id" });
  if (erroVenda) throw erroVenda;
  if (detalhe.recebiveis.length > 0) {
    const { error } = await admin.from("recebiveis_sumup").upsert(
      detalhe.recebiveis.map((r) => ({
        id: r.id,
        id_transacao: venda.id,
        conta,
        codigo_transacao: venda.codigo,
        tipo: r.tipo,
        status: r.status,
        parcela: r.parcela,
        valor_liquido: r.valorLiquido,
        taxa: r.taxa,
        moeda: venda.moeda,
        data_prevista: r.dataPrevista,
        data_pagamento: r.dataPagamento,
        sincronizado_em: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
  }
  const { error } = await admin
    .from("transacoes_sumup")
    .update({
      simple_status: detalhe.simpleStatus,
      dados: detalhe.dados,
      detalhado_em: new Date().toISOString(),
    })
    .eq("id", venda.id);
  if (error) throw error;
  return detalhe.recebiveis.length;
}

/** Lê cada código SumUp das ordens nas contas de Portugal e do Brasil e baixa o repasse pago. */
async function baixarCodigosDasOrdens(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("parcelas_venda")
    .select("codigo_transacao, vendas!inner(status_venda)")
    .not("codigo_transacao", "is", null);
  if (error) throw error;
  const codigos = [
    ...new Set(
      (data ?? [])
        .filter((linha) => {
          const venda = linha.vendas as { status_venda?: string } | { status_venda?: string }[] | null;
          const status = Array.isArray(venda) ? venda[0]?.status_venda : venda?.status_venda;
          return status !== "cancelado";
        })
        .map((linha) => (linha.codigo_transacao ?? "").trim().toUpperCase())
        .filter((codigo) => /^T[A-Z0-9]{6,24}$/.test(codigo)),
    ),
  ];

  const resumo = {
    codigos: codigos.length,
    portugal: 0,
    brasil: 0,
    ausentes: [] as string[],
    recebiveis: 0,
    falhas: [] as string[],
  };

  await emLotes(codigos, 4, async (codigo) => {
    let achou = false;
    for (const conta of ["pt", "br"] as Conta[]) {
      try {
        const detalhe = await obterDetalhe(conta, "transaction_code", codigo);
        if (!detalhe?.venda) continue;
        achou = true;
        if (conta === "pt") resumo.portugal += 1;
        else resumo.brasil += 1;
        resumo.recebiveis += await gravarDetalhe(admin, conta, detalhe);
      } catch (erro) {
        resumo.falhas.push(
          `${codigo} ${conta}: ${erro instanceof Error ? sanitizar(erro.message) : "falha"}`,
        );
      }
    }
    if (!achou) resumo.ausentes.push(codigo);
  });

  let conciliacao: Record<string, number> = { transacoes: 0, atualizadas: 0, baixadas: 0, divergentes: 0 };
  for (let i = 0; i < codigos.length; i += 500) {
    const { data: parcialRaw, error: erroConc } = await admin.rpc("conciliar_recebiveis_sumup", {
      p_codigos: codigos.slice(i, i + 500),
    });
    if (erroConc) throw erroConc;
    const parcial = (parcialRaw ?? {}) as Record<string, number>;
    conciliacao = Object.fromEntries(
      Object.keys(conciliacao).map((k) => [k, conciliacao[k] + Number(parcial[k] ?? 0)]),
    );
  }

  return {
    ...resumo,
    ausentes: resumo.ausentes.slice(0, 40),
    falhas: resumo.falhas.slice(0, 15),
    conciliacao,
  };
}

function periodoPadrao(): { de: string; ate: string } {
  const hoje = new Date();
  const inicio = new Date(hoje.getTime() - 45 * 86_400_000);
  return { de: inicio.toISOString().slice(0, 10), ate: hoje.toISOString().slice(0, 10) };
}

function lerPeriodo(corpo: Record<string, unknown>): { de: string; ate: string } {
  const de = dataValida(corpo.de);
  const ate = dataValida(corpo.ate);
  if (!de || !ate) throw new ErroConsulta("Informe o período com datas válidas.", 400);
  if (ate < de) throw new ErroConsulta("A data final é anterior à data inicial.", 400);
  const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000;
  if (dias > MAX_DIAS) throw new ErroConsulta("O período pode ter no máximo um ano.", 400);
  return { de, ate };
}

function lerConta(valor: unknown): Conta {
  if (valor === "pt" || valor === "br") return valor;
  throw new ErroConsulta("Informe a conta SumUp: pt ou br.", 400);
}

async function autorizarAtivo(req: Request, admin: SupabaseClient): Promise<void> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ErroConsulta("Sessão ausente.", 401);
  const cliente = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: usuario, error } = await cliente.auth.getUser();
  if (error || !usuario.user) throw new ErroConsulta("Sessão ausente.", 401);
  const perfil = await admin
    .from("perfis_usuario")
    .select("id")
    .eq("id", usuario.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (perfil.error || !perfil.data) throw new ErroConsulta("Acesso restrito.", 403);
}

async function autorizar(req: Request): Promise<"servico" | "equipe"> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ErroConsulta("Sessão ausente.", 401);
  const tokensServico = [Deno.env.get("SUMUP_CRON_TOKEN"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")];
  if (tokensServico.some((t) => t && t.length >= 20 && token === t)) return "servico";

  const cliente = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await cliente.rpc("is_equipe_crm");
  if (error || data !== true) throw new ErroConsulta("Acesso restrito à equipe do CRM.", 403);
  return "equipe";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder(405, { mensagem: "Método não permitido." });

  try {
    const corpo = objeto(await req.json().catch(() => null)) ?? {};
    const acao = texto(corpo.acao);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const evento = texto(corpo.event_type);
    if (evento) {
      try {
        if (evento === "CHECKOUT_STATUS_CHANGED") {
          const idCheckout = texto(corpo.id);
          if (idCheckout) await processarRetornoCheckout(admin, idCheckout);
        }
        return new Response(null, { status: 200 });
      } catch (erro) {
        console.error("retorno sumup", erro instanceof Error ? sanitizar(erro.message) : "falha");
        return new Response(null, { status: 500 });
      }
    }

    if (acao === "checkout") {
      await autorizarAtivo(req, admin);
      const conta = lerConta(corpo.conta);
      const criado = await criarCheckout(conta, lerValorCheckout(corpo.valor), texto(corpo.descricao), null);
      const { error } = await admin.from("checkouts_sumup").upsert(
        {
          id_checkout: criado.id,
          conta,
          valor: criado.valor,
          moeda: criado.moeda,
          status: "PENDING",
          url: criado.url,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "id_checkout" },
      );
      if (error) throw new ErroConsulta("Não foi possível guardar o link para o retorno do pagamento.", 500);
      return responder(200, { id: criado.id, url: criado.url, valor: criado.valor, moeda: criado.moeda });
    }

    const origem = await autorizar(req);

    if (acao === "transacoes") {
      const conta = lerConta(corpo.conta);
      const { de, ate } = lerPeriodo(corpo);
      const status = texto(corpo.status);
      if (status && !STATUS_PERMITIDOS.has(status)) {
        throw new ErroConsulta("Status de venda não reconhecido.", 400);
      }
      const historico = await listarHistorico(conta, de, ate, status);
      return responder(200, {
        merchantCode: historico.merchant,
        truncado: historico.truncado,
        itens: historico.itens,
      });
    }

    if (acao === "transacao") {
      const conta = lerConta(corpo.conta);
      const codigo = (texto(corpo.codigo) ?? "").toUpperCase();
      if (!/^T[A-Z0-9]{6,24}$/.test(codigo)) {
        throw new ErroConsulta("Informe um código de transação da SumUp.", 400);
      }
      const detalhe = await obterDetalhe(conta, "transaction_code", codigo);
      return responder(200, {
        merchantCode: await obterMerchantCode(conta),
        item: detalhe?.venda ?? null,
        recebiveis: detalhe?.recebiveis ?? [],
      });
    }

    if (acao === "baixar_codigos") {
      return responder(200, await baixarCodigosDasOrdens(admin));
    }

    if (acao === "sincronizar") {
      const contas: Conta[] =
        corpo.conta === undefined && origem === "servico" ? ["pt", "br"] : [lerConta(corpo.conta)];
      const { de, ate } = corpo.de === undefined && origem === "servico" ? periodoPadrao() : lerPeriodo(corpo);
      const resultados = [];
      for (const conta of contas) {
        try {
          resultados.push(await sincronizar(admin, conta, de, ate));
        } catch (erro) {
          if (contas.length === 1) throw erro;
          resultados.push({ conta, erro: erro instanceof Error ? sanitizar(erro.message) : "falha" });
        }
      }
      return responder(200, { de, ate, resultados });
    }

    throw new ErroConsulta("Ação não reconhecida.", 400);
  } catch (erro) {
    const status = erro instanceof ErroConsulta ? erro.status : 500;
    const mensagem =
      erro instanceof Error
        ? sanitizar(erro.message)
        : sanitizar(String((erro as { message?: unknown })?.message ?? "Falha ao consultar a SumUp."));
    return responder(status, { mensagem });
  }
});
