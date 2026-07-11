import type { Database, Json } from "../../tipos/database.js";
import {
  normalizarTexto,
  paraDataApenas,
  paraDataIso,
  paraNumeroOuNulo,
} from "../../utils/normalizacao.js";
import type { TinyPedidoDetalhe, TinyPedidoItemDetalhe } from "./tinyTipos.js";

type StatusVenda = Database["public"]["Enums"]["status_venda_enum"];

export interface DadosItemVendaParseado {
  idProdutoTiny: string | null;
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valorUnitario: number;
  dadosTiny: Json;
}

export interface DadosVendaParseada {
  idTiny: string;
  numero: string | null;
  numeroEcommerce: string | null;
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
  meioPagamento: string | null;
  deposito: string | null;
  codigoRastreamento: string | null;
  urlRastreamento: string | null;
  obs: string | null;
  obsInterna: string | null;
  marcadores: Json | null;
  dadosTiny: Json;
  itens: DadosItemVendaParseado[];
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

  return {
    idTiny: String(pedido.id),
    numero: normalizarTexto(pedido.numero),
    numeroEcommerce: normalizarTexto(pedido.numero_ecommerce),
    nomeCliente: normalizarTexto(pedido.cliente?.nome),
    regiaoVenda,
    dataPedido: paraDataIso(pedido.data_pedido),
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
    valorTotal: paraNumeroOuNulo(pedido.total_pedido) ?? 0,
    formaPagamento: normalizarTexto(pedido.forma_pagamento),
    meioPagamento: normalizarTexto(pedido.meio_pagamento),
    deposito: normalizarTexto(pedido.deposito),
    codigoRastreamento: normalizarTexto(pedido.codigo_rastreamento),
    urlRastreamento: normalizarTexto(pedido.url_rastreamento),
    obs: normalizarTexto(pedido.obs),
    obsInterna: normalizarTexto(pedido.obs_interna),
    marcadores,
    dadosTiny: pedido as unknown as Json,
    itens,
  };
}
