import type { Connect, Plugin } from "vite";
import { loadEnv } from "vite";
import { inicioDoDiaPortugalIso, inicioDoDiaSeguintePortugalIso } from "../src/utils/fusoPortugal";

const CAMINHO = "/api/sumup/transacoes";
const CAMINHO_TRANSACAO = "/api/sumup/transacao";
const CAMINHO_CHECKOUT = "/api/sumup/checkout";
const ORIGEM = "https://api.sumup.com";
const LIMITE_PAGINA = "100";
const MAX_PAGINAS = 40;
const MAX_DIAS = 366;

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
  "transaction_code",
  "changes_since",
  "statuses[]",
  "statuses",
  "payment_types[]",
  "payment_types",
  "types[]",
  "types",
  "users[]",
  "users",
  "entry_modes[]",
  "entry_modes",
]);

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
};

type RespostaHttp = {
  statusCode: number;
  setHeader: (nome: string, valor: string) => void;
  end: (corpo: string) => void;
  writableEnded?: boolean;
};

class ErroConsulta extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let merchantEmCache: { chave: string; codigo: string } | null = null;

function responder(res: RespostaHttp, status: number, corpo: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(corpo));
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

function sanitizar(mensagem: string): string {
  return mensagem.replace(/sup_sk_[A-Za-z0-9._-]+/g, "[chave]").slice(0, 300);
}

function dataLocalValida(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }
  return data;
}

function inicioDoDiaIso(data: Date): string {
  return inicioDoDiaPortugalIso(data.getFullYear(), data.getMonth() + 1, data.getDate());
}

function inicioDoDiaSeguinteIso(data: Date): string {
  return inicioDoDiaSeguintePortugalIso(data.getFullYear(), data.getMonth() + 1, data.getDate());
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

async function chamarSumup(url: string, chave: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${chave}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function lerJson(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let tamanho = 0;
    req.on("data", (parte: Buffer) => {
      tamanho += parte.length;
      if (tamanho > 8_000) {
        reject(new ErroConsulta("Pedido grande demais.", 413));
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      const bruto = Buffer.concat(partes).toString("utf8").trim();
      if (!bruto) {
        resolve({});
        return;
      }
      try {
        const json = JSON.parse(bruto) as unknown;
        if (!json || typeof json !== "object" || Array.isArray(json)) {
          reject(new ErroConsulta("Pedido inválido.", 400));
          return;
        }
        resolve(json as Record<string, unknown>);
      } catch {
        reject(new ErroConsulta("Pedido inválido.", 400));
      }
    });
    req.on("error", reject);
  });
}

function lerValorCheckout(valor: unknown): number {
  const numeroValor = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor.replace(",", ".")) : NaN;
  if (!Number.isFinite(numeroValor) || numeroValor <= 0 || numeroValor > 999_999.99) {
    throw new ErroConsulta("Informe um valor válido.", 400);
  }
  return Math.round(numeroValor * 100) / 100;
}

async function atenderCheckout(
  req: Connect.IncomingMessage,
  res: RespostaHttp,
  lerEnv: () => Record<string, string>,
) {
  const env = lerEnv();
  const corpo = await lerJson(req);
  const brasil = corpo.conta === "br";
  if (corpo.conta !== "br" && corpo.conta !== "pt") {
    throw new ErroConsulta("Informe a conta SumUp: pt ou br.", 400);
  }
  const nomeChave = brasil ? "SUMUP_BR_API_KEY" : "SUMUP_API_KEY";
  const chave = (brasil ? env.SUMUP_BR_API_KEY : env.SUMUP_PT_API_KEY || env.SUMUP_API_KEY)?.trim();
  const merchantConfigurado = brasil
    ? env.SUMUP_BR_MERCHANT_CODE
    : env.SUMUP_PT_MERCHANT_CODE || env.SUMUP_MERCHANT_CODE;
  if (!chave) {
    throw new ErroConsulta(
      `${nomeChave} não está no .env.local. Cole a chave secreta da SumUp, sem o prefixo VITE_, e salve o arquivo.`,
      503,
    );
  }

  const valor = lerValorCheckout(corpo.valor);
  const moeda = brasil ? "BRL" : "EUR";
  const descricao = (texto(corpo.descricao) ?? "Galeria KropCafé").slice(0, 140);
  const merchant = await obterMerchantCode(chave, merchantConfigurado);
  const resposta = await chamarSumup(`${ORIGEM}/v0.1/checkouts`, chave, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkout_reference: crypto.randomUUID(),
      amount: valor,
      currency: moeda,
      merchant_code: merchant,
      description: descricao,
      hosted_checkout: { enabled: true },
    }),
  });
  if (resposta.status === 403) {
    throw new ErroConsulta(
      `A SumUp ${brasil ? "Brasil" : "Europa"} recusou o link. A chave precisa de permissão para criar pagamentos online.`,
      403,
    );
  }
  if (!resposta.ok) {
    throw new ErroConsulta(await lerErroSumup(resposta), 502);
  }
  const criado = (await resposta.json()) as { hosted_checkout_url?: unknown };
  const url = texto(criado.hosted_checkout_url);
  if (!url) {
    throw new ErroConsulta("A SumUp não devolveu o link de pagamento.", 502);
  }
  responder(res, 200, { url, valor, moeda });
}

function codigoDoPerfil(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const raiz = corpo as Record<string, unknown>;
  const direto = texto(raiz.merchant_code);
  if (direto) return direto;
  const perfil = raiz.merchant_profile;
  if (perfil && typeof perfil === "object") {
    return texto((perfil as Record<string, unknown>).merchant_code);
  }
  return null;
}

async function obterMerchantCode(chave: string, configurado: string | undefined): Promise<string> {
  const informado = configurado?.trim();
  if (informado) return informado;
  if (merchantEmCache?.chave === chave) return merchantEmCache.codigo;

  const resposta = await chamarSumup(`${ORIGEM}/v0.1/me`, chave);
  if (resposta.status === 401) {
    throw new ErroConsulta(
      "A chave da SumUp foi recusada. Confira a chave no .env.local.",
      401,
    );
  }
  if (!resposta.ok) {
    throw new ErroConsulta(await lerErroSumup(resposta), 502);
  }

  const codigo = codigoDoPerfil(await resposta.json());
  if (!codigo) {
    throw new ErroConsulta(
      "A SumUp não devolveu o código da conta. Informe o merchant code da conta no .env.local.",
      502,
    );
  }
  merchantEmCache = { chave, codigo };
  return codigo;
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
    const consulta = href.startsWith("?") ? href.slice(1) : href;
    origem = new URLSearchParams(consulta);
  }

  const limpos = new URLSearchParams();
  for (const [chave, valor] of origem.entries()) {
    if (PARAMETROS_PROXIMA_PAGINA.has(chave)) limpos.append(chave, valor);
  }
  return [...limpos.keys()].length > 0 ? limpos : null;
}

function normalizarVenda(bruto: unknown, indice: number): VendaSumup | null {
  if (!bruto || typeof bruto !== "object") return null;
  const item = bruto as Record<string, unknown>;
  const codigo = texto(item.transaction_code);
  const data = texto(item.timestamp);
  const id =
    texto(item.transaction_id) ??
    texto(item.id) ??
    (codigo && data ? `${codigo}-${data}` : `sumup-${indice}`);
  const valor = numero(item.amount);
  if (valor === null || !data) return null;

  return {
    id,
    codigo,
    valor,
    moeda: texto(item.currency) ?? "EUR",
    data,
    status: texto(item.status) ?? "UNKNOWN",
    tipo: texto(item.type),
    tipoPagamento: texto(item.payment_type),
    cartao: texto(item.card_type) ?? cartaoAninhado(item.card),
    parcelas: numero(item.installments_count),
    descricao: texto(item.product_summary),
    valorEstornado: numero(item.refunded_amount),
    usuario: texto(item.user) ?? texto(item.username),
    dataRepasse: texto(item.payout_date),
  };
}

function cartaoAninhado(valor: unknown): string | null {
  if (!valor || typeof valor !== "object") return null;
  return texto((valor as Record<string, unknown>).type);
}

function codigoSumupValido(valor: string): boolean {
  return /^T[A-Z0-9]{6,24}$/i.test(valor);
}

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

function dia(valor: unknown): string | null {
  const t = texto(valor);
  return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
}

/** `events` traz líquido e taxa; `transaction_events` (mesmo id) traz data prevista e paga. */
function extrairRecebiveis(detalhe: Record<string, unknown>): RecebivelSumup[] {
  const lista = (v: unknown) =>
    Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
  const eventosTransacao = lista(detalhe.transaction_events);
  return lista(detalhe.events).map((ev) => {
    const te = eventosTransacao.find((x) => String(x.id ?? "") === String(ev.id ?? ""));
    const status = texto(ev.status) ?? texto(te?.status);
    const valorLiquido = numero(ev.amount);
    const taxa = numero(ev.fee_amount);
    const dataPrevista = dia(te?.due_date) ?? dia(te?.date) ?? dia(ev.timestamp);
    return {
      id: String(ev.id ?? ""),
      tipo: texto(ev.type) ?? "DESCONHECIDO",
      status,
      parcela: numero(ev.installment_number),
      valorLiquido,
      taxa,
      valorBruto: valorLiquido === null ? null : Math.round((valorLiquido + (taxa ?? 0)) * 100) / 100,
      dataPrevista,
      dataPagamento: status === "PAID_OUT" ? dia(te?.date) ?? dia(ev.timestamp) ?? dataPrevista : null,
    };
  });
}

async function obterPorCodigo(
  chave: string,
  codigo: string,
): Promise<{ item: VendaSumup | null; recebiveis: RecebivelSumup[] }> {
  const resposta = await chamarSumup(
    `${ORIGEM}/v0.1/me/transactions?transaction_code=${encodeURIComponent(codigo)}`,
    chave,
  );
  if (resposta.status === 404) return { item: null, recebiveis: [] };
  if (resposta.status === 401) {
    throw new ErroConsulta("A chave da SumUp foi recusada. Confira a chave no .env.local.", 401);
  }
  if (!resposta.ok) {
    throw new ErroConsulta(await lerErroSumup(resposta), 502);
  }

  const corpo = (await resposta.json()) as unknown;
  const bruto = Array.isArray(corpo)
    ? corpo[0]
    : corpo && typeof corpo === "object" && Array.isArray((corpo as { items?: unknown[] }).items)
      ? (corpo as { items: unknown[] }).items[0]
      : corpo;
  return {
    item: normalizarVenda(bruto, 0),
    recebiveis:
      bruto && typeof bruto === "object" ? extrairRecebiveis(bruto as Record<string, unknown>) : [],
  };
}

async function listarHistorico(
  chave: string,
  merchant: string,
  de: Date,
  ate: Date,
  status: string | null,
): Promise<{ itens: VendaSumup[]; truncado: boolean }> {
  const base = `${ORIGEM}/v2.1/merchants/${encodeURIComponent(merchant)}/transactions/history`;
  let parametros = new URLSearchParams();
  parametros.set("limit", LIMITE_PAGINA);
  parametros.set("order", "descending");
  parametros.set("oldest_time", inicioDoDiaIso(de));
  parametros.set("newest_time", inicioDoDiaSeguinteIso(ate));
  if (status) parametros.append("statuses[]", status);

  const itens: VendaSumup[] = [];
  let truncado = false;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const resposta = await chamarSumup(`${base}?${parametros.toString()}`, chave);
    if (resposta.status === 401) {
      throw new ErroConsulta(
        "A chave da SumUp foi recusada. Confira a chave no .env.local.",
        401,
      );
    }
    if (!resposta.ok) {
      throw new ErroConsulta(await lerErroSumup(resposta), 502);
    }

    const corpo = (await resposta.json()) as {
      items?: unknown[];
      links?: { rel?: string; href?: string }[];
    };
    for (const item of corpo.items ?? []) {
      const venda = normalizarVenda(item, itens.length);
      if (venda) itens.push(venda);
    }

    const proximo = corpo.links?.find((link) => link.rel === "next" && link.href);
    if (!proximo?.href) break;
    const seguintes = parametrosDaProximaPagina(proximo.href);
    if (!seguintes) break;
    if (pagina === MAX_PAGINAS - 1) {
      truncado = true;
      break;
    }
    parametros = seguintes;
  }

  return { itens, truncado };
}

async function atender(
  req: Connect.IncomingMessage,
  res: RespostaHttp,
  lerEnv: () => Record<string, string>,
) {
  const env = lerEnv();
  const consulta = new URL(req.url ?? CAMINHO, "http://localhost");
  const brasil = consulta.searchParams.get("conta") === "br";
  const nomeChave = brasil ? "SUMUP_BR_API_KEY" : "SUMUP_API_KEY";
  const chave = (brasil ? env.SUMUP_BR_API_KEY : env.SUMUP_PT_API_KEY || env.SUMUP_API_KEY)?.trim();
  const merchantConfigurado = brasil
    ? env.SUMUP_BR_MERCHANT_CODE
    : env.SUMUP_PT_MERCHANT_CODE || env.SUMUP_MERCHANT_CODE;
  if (!chave) {
    throw new ErroConsulta(
      `${nomeChave} não está no .env.local. Cole a chave secreta da SumUp, sem o prefixo VITE_, e salve o arquivo.`,
      503,
    );
  }

  const caminho = consulta.pathname;
  if (caminho === CAMINHO_TRANSACAO) {
    const codigo = (consulta.searchParams.get("codigo") ?? "").trim();
    if (!codigoSumupValido(codigo)) {
      throw new ErroConsulta("Informe um código de transação da SumUp.", 400);
    }
    const merchant = await obterMerchantCode(chave, merchantConfigurado);
    const detalhe = await obterPorCodigo(chave, codigo.toUpperCase());
    responder(res, 200, { merchantCode: merchant, ...detalhe });
    return;
  }

  const deTexto = consulta.searchParams.get("de") ?? "";
  const ateTexto = consulta.searchParams.get("ate") ?? "";
  const de = dataLocalValida(deTexto);
  const ate = dataLocalValida(ateTexto);
  if (!de || !ate) {
    throw new ErroConsulta("Informe o período com datas válidas.", 400);
  }
  if (ate.getTime() < de.getTime()) {
    throw new ErroConsulta("A data final é anterior à data inicial.", 400);
  }
  const dias = Math.round((ate.getTime() - de.getTime()) / 86_400_000);
  if (dias > MAX_DIAS) {
    throw new ErroConsulta("O período pode ter no máximo um ano.", 400);
  }

  const status = consulta.searchParams.get("status");
  if (status && !STATUS_PERMITIDOS.has(status)) {
    throw new ErroConsulta("Status de venda não reconhecido.", 400);
  }

  const merchant = await obterMerchantCode(chave, merchantConfigurado);
  const historico = await listarHistorico(chave, merchant, de, ate, status);

  responder(res, 200, {
    merchantCode: merchant,
    truncado: historico.truncado,
    itens: historico.itens,
  });
}

export function sumupApiPlugin(): Plugin {
  let modo = "development";
  let envDir = "";

  const lerEnv = () => loadEnv(modo, envDir, "");

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const caminho = (req.url ?? "").split("?")[0];
    if (caminho === CAMINHO_CHECKOUT) {
      if (req.method !== "POST") {
        responder(res, 405, { mensagem: "Método não permitido." });
        return;
      }
      void atenderCheckout(req, res, lerEnv).catch((erro: unknown) => {
        if (res.writableEnded) return;
        const status = erro instanceof ErroConsulta ? erro.status : 500;
        const mensagem =
          erro instanceof Error ? sanitizar(erro.message) : "Falha ao criar o link da SumUp.";
        responder(res, status, { mensagem });
      });
      return;
    }
    if (caminho !== CAMINHO && caminho !== CAMINHO_TRANSACAO) {
      next();
      return;
    }
    if (req.method !== "GET") {
      responder(res, 405, { mensagem: "Método não permitido." });
      return;
    }
    void atender(req, res, lerEnv).catch((erro: unknown) => {
      if (res.writableEnded) return;
      const status = erro instanceof ErroConsulta ? erro.status : 500;
      const mensagem =
        erro instanceof Error ? sanitizar(erro.message) : "Falha ao consultar a SumUp.";
      responder(res, status, { mensagem });
    });
  };

  return {
    name: "sumup-api",
    configResolved(config) {
      modo = config.mode;
      envDir = config.envDir;
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
