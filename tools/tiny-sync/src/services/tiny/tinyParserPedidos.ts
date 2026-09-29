import type { Database, Json } from "../../tipos/database.js";
import {
  normalizarTexto,
  paraDataApenas,
  paraDataIso,
  paraNumeroOuNulo,
} from "../../utils/normalizacao.js";
import type { TinyPedidoDetalhe, TinyPedidoItemDetalhe, TinyPedidoParcela } from "./tinyTipos.js";

type StatusVenda = Database["public"]["Enums"]["status_venda_enum"];

export interface DadosItemVendaParseado {
  idProdutoTiny: string | null;
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valorUnitario: number;
  dadosTiny: Json;
}

export interface DadosParcelaVendaParseada {
  numero: number;
  dataVencimento: string | null;
  valor: number;
  formaPagamento: string | null;
  meioPagamento: string | null;
  dias: number | null;
  obs: string | null;
  dadosTiny: Json | null;
}

export interface DadosVendaParseada {
  idTiny: string;
  numero: string | null;
  numeroEcommerce: string | null;
  /** Código da SumUp, gravado no Tiny no campo número da ordem de compra. */
  codigoVendaAdquirente: string | null;
  nomeCliente: string | null;
  regiaoVenda: Database["public"]["Enums"]["tipo_regiao_enum"];
  dataPedido: string | null;
  dataPrevista: string | null;
  dataFaturamento: string | null;
  dataEnvio: string | null;
  dataEntrega: string | null;
  statusVenda: StatusVenda;
  situacaoTiny: string | null;
  totalProdutos: number;
  valorFrete: number;
  valorDesconto: number;
  outrasDespesas: number;
  valorTotal: number;
  formaPagamento: string | null;
  deposito: string | null;
  codigoRastreamento: string | null;
  urlRastreamento: string | null;
  obs: string | null;
  obsInterna: string | null;
  marcadores: Json | null;
  dadosTiny: Json;
  itens: DadosItemVendaParseado[];
  parcelas: DadosParcelaVendaParseada[];
}

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Mapeia a `situacao` textual do Tiny para o enum status_venda_enum do CRM.
 * Situacoes conhecidas do Tiny: Em aberto, Aprovado, Preparando envio,
 * Faturado, Pronto para envio, Enviado, Entregue, Nao entregue, Cancelado.
 */
export function mapearStatusVenda(situacao: string | null | undefined): StatusVenda {
  const s = semAcento(String(situacao ?? ""));
  if (!s) return "em_aberto";

  if (s.includes("cancel")) return "cancelado";
  if (s.includes("entregue") && !s.includes("nao")) return "finalizado";
  if (s.includes("finaliz") || s.includes("conclu") || s.includes("atendid")) {
    return "finalizado";
  }
  if (s.includes("enviado") || s.includes("pronto para envio") || s.includes("transito") || s.includes("transporte")) {
    return "enviado";
  }
  if (s.includes("preparando") || s.includes("separac") || s.includes("separacao")) {
    return "preparando_envio";
  }
  if (s.includes("aprovad") || s.includes("pago") || s.includes("faturad")) {
    return "pago";
  }
  // Em aberto, aguardando pagamento, nao entregue e demais casos.
  return "em_aberto";
}

function parseItemPedido(item: TinyPedidoItemDetalhe): DadosItemVendaParseado {
  return {
    idProdutoTiny: normalizarTexto(item.id_produto),
    codigo: normalizarTexto(item.codigo),
    descricao: normalizarTexto(item.descricao),
    quantidade: paraNumeroOuNulo(item.quantidade) ?? 1,
    valorUnitario: paraNumeroOuNulo(item.valor_unitario) ?? 0,
    dadosTiny: item as unknown as Json,
  };
}

type Regiao = Database["public"]["Enums"]["tipo_regiao_enum"];

/**
 * Converte a forma do Tiny para o catálogo do CRM (mesma regra da migration de contas a receber).
 * Na Europa o meio (Revolut, SumUp...) vinha gravado como forma. `contareceber` não é forma.
 */
export function normalizarFormaPagamento(
  forma: string | null,
  meio: string | null,
  regiao: Regiao,
): { forma: string | null; meio: string | null } {
  if (!forma) return { forma: null, meio };
  if (forma.toLowerCase() === "contareceber") return { forma: null, meio };
  if (forma === "MBWay") return { forma: "mbway", meio };
  if (forma === "Presente / Amostra grátis") return { forma: "cortesia", meio };
  if (regiao === "europa") {
    if (forma === "Revolut" || forma === "Wise") {
      return { forma: "transferencia", meio: meio ?? forma };
    }
    if (forma === "SumUp Máquina" || forma === "SumUp Link" || forma === "Stripe") {
      return { forma: "cartao", meio: forma };
    }
    if (forma === "credito") return { forma: "cartao", meio };
  }
  return { forma, meio };
}

/** Primeiro código de transação SumUp (T + 6 ou mais caracteres), se houver um único no texto. */
export function codigoSumupUnico(texto: string | null): string | null {
  if (!texto) return null;
  const codigos = new Set(texto.toUpperCase().match(/T[A-Z0-9]{6,}/g) ?? []);
  return codigos.size === 1 ? ([...codigos][0] ?? null) : null;
}

function parseParcelasPedido(
  pedido: TinyPedidoDetalhe,
  regiao: Regiao,
): DadosParcelaVendaParseada[] {
  const raw = pedido.parcelas;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const meioPedido = normalizarTexto(pedido.meio_pagamento);
  const saida: DadosParcelaVendaParseada[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const nested = (entry as { parcela?: TinyPedidoParcela }).parcela;
    const p = nested && typeof nested === "object" ? nested : (entry as TinyPedidoParcela);
    const { forma, meio } = normalizarFormaPagamento(
      normalizarTexto(p.forma_pagamento),
      normalizarTexto(p.meio_pagamento) ?? meioPedido,
      regiao,
    );
    const dias = paraNumeroOuNulo(p.dias);

    saida.push({
      numero: saida.length + 1,
      dataVencimento: paraDataApenas(p.data),
      valor: paraNumeroOuNulo(p.valor) ?? 0,
      formaPagamento: forma,
      meioPagamento: meio,
      dias: dias != null ? Math.trunc(dias) : null,
      obs: normalizarTexto(p.obs),
      dadosTiny: p as unknown as Json,
    });
  }
  return saida;
}

/** Pedido sem parcelas no Tiny e com forma simples vira uma parcela com o total. */
function parcelaUnicaDoPedido(
  forma: string | null,
  meio: string | null,
  valorTotal: number,
  dataPedido: string | null,
): DadosParcelaVendaParseada[] {
  if (!forma || forma === "cortesia" || forma === "multiplas" || valorTotal <= 0) return [];
  return [
    {
      numero: 1,
      dataVencimento: dataPedido ? dataPedido.slice(0, 10) : null,
      valor: valorTotal,
      formaPagamento: forma,
      meioPagamento: meio,
      dias: 0,
      obs: null,
      dadosTiny: null,
    },
  ];
}

export function parsePedidoTiny(
  pedido: TinyPedidoDetalhe,
  regiaoVenda: Database["public"]["Enums"]["tipo_regiao_enum"] = "brasil",
): DadosVendaParseada {
  const itens = (pedido.itens ?? [])
    .map((i) => i.item)
    .filter((i): i is TinyPedidoItemDetalhe => Boolean(i))
    .map(parseItemPedido);

  const marcadores =
    Array.isArray(pedido.marcadores) && pedido.marcadores.length > 0
      ? (pedido.marcadores.map((m) => m.marcador) as unknown as Json)
      : null;

  const pagamentoPedido = normalizarFormaPagamento(
    normalizarTexto(pedido.forma_pagamento),
    normalizarTexto(pedido.meio_pagamento),
    regiaoVenda,
  );
  const valorTotal = paraNumeroOuNulo(pedido.total_pedido) ?? 0;
  const dataPedido = paraDataIso(pedido.data_pedido);
  const parcelasTiny = parseParcelasPedido(pedido, regiaoVenda);
  const parcelas =
    parcelasTiny.length > 0
      ? parcelasTiny
      : parcelaUnicaDoPedido(pagamentoPedido.forma, pagamentoPedido.meio, valorTotal, dataPedido);

  return {
    idTiny: String(pedido.id),
    numero: normalizarTexto(pedido.numero),
    numeroEcommerce: normalizarTexto(pedido.numero_ecommerce),
    codigoVendaAdquirente: normalizarTexto(pedido.numero_ordem_compra),
    nomeCliente: normalizarTexto(pedido.cliente?.nome),
    regiaoVenda,
    dataPedido,
    dataPrevista: paraDataApenas(pedido.data_prevista),
    dataFaturamento: paraDataApenas(pedido.data_faturamento),
    dataEnvio: paraDataApenas(pedido.data_envio),
    dataEntrega: paraDataApenas(pedido.data_entrega),
    statusVenda: mapearStatusVenda(pedido.situacao),
    situacaoTiny: normalizarTexto(pedido.situacao),
    totalProdutos: paraNumeroOuNulo(pedido.total_produtos) ?? 0,
    valorFrete: paraNumeroOuNulo(pedido.valor_frete) ?? 0,
    valorDesconto: paraNumeroOuNulo(pedido.valor_desconto) ?? 0,
    outrasDespesas: paraNumeroOuNulo(pedido.outras_despesas) ?? 0,
    valorTotal,
    formaPagamento: pagamentoPedido.forma,
    deposito: normalizarTexto(pedido.deposito),
    codigoRastreamento: normalizarTexto(pedido.codigo_rastreamento),
    urlRastreamento: normalizarTexto(pedido.url_rastreamento),
    obs: normalizarTexto(pedido.obs),
    obsInterna: normalizarTexto(pedido.obs_interna),
    marcadores,
    dadosTiny: pedido as unknown as Json,
    itens,
    parcelas,
  };
}
