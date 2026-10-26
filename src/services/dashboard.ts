import { supabase } from "../lib/supabase";
import type { StatusVenda, TipoRegiao } from "../types/entities";
import { vitrinesService } from "./vitrines";

export type PeriodoDashboard = "mes" | "30d" | "ano";

export interface IntervaloDashboard {
  de: Date;
  ate: Date;
  deAnterior: Date;
  ateAnterior: Date;
}

export interface ResumoVendasRegiao {
  regiao: TipoRegiao;
  moeda: string;
  faturamento: number;
  vendas: number;
  faturamentoAnterior: number;
  vendasAnterior: number;
}

export interface ResumoFinanceiroRegiao {
  regiao: TipoRegiao;
  moeda: string;
  recebido: number;
  recebidoAnterior: number;
  emAberto: number;
  vencido: number;
  quantidadeVencida: number;
}

export interface ResumoEstoqueRegiao {
  regiao: TipoRegiao | "sem_local";
  pares: number;
  valorPorMoeda: Record<string, number>;
}

export interface PendenciasDashboard {
  avisosNaoLidos: number;
  contasDivergentes: number;
  fretePendente: number;
  alertasVitrine: number;
  conferenciasAbertas: number;
  carrinhosAbertos: number;
  itensReservados: number;
  itensTransferencia: number;
  itensEmCompra: number;
}

export type StatusAndamento = Extract<StatusVenda, "em_aberto" | "pago" | "preparando_envio" | "enviado">;

export const STATUS_ANDAMENTO: StatusAndamento[] = ["em_aberto", "pago", "preparando_envio", "enviado"];

export interface MesHistorico {
  /** YYYY-MM */
  mes: string;
  porRegiao: Partial<Record<TipoRegiao, number>>;
}

export interface VendaRecente {
  id: string;
  numero: string | null;
  nome_cliente: string | null;
  regiao_venda: TipoRegiao;
  moeda_venda: string;
  status_venda: StatusVenda;
  valor_total: number;
  data_pedido: string | null;
}

export interface ModeloMaisVendido {
  chave: string;
  idModelo: string | null;
  nome: string;
  pares: number;
}

export interface ResumoLinksPedido {
  linksAtivos: number;
  linksCriados: number;
  linksCriadosAnterior: number;
  linksComVenda: number;
  acessos: number;
  vendas: number;
  vendasAnterior: number;
  faturamentoPorMoeda: Record<string, number>;
}

export interface DashboardResumo {
  links: ResumoLinksPedido;
  vendas: ResumoVendasRegiao[];
  financeiro: ResumoFinanceiroRegiao[];
  estoque: ResumoEstoqueRegiao[];
  pendencias: PendenciasDashboard;
  andamento: Record<StatusAndamento, Partial<Record<TipoRegiao, number>>>;
  historico: MesHistorico[];
  maisVendidos: ModeloMaisVendido[];
}

const MESES_HISTORICO = 6;

function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Mesmo dia em outro mês, sem estourar meses curtos (31/03 → 28/02). */
function deslocarMeses(d: Date, meses: number): Date {
  const alvo = new Date(d.getFullYear(), d.getMonth() + meses, 1, d.getHours(), d.getMinutes());
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d.getDate(), ultimoDia));
  return alvo;
}

/** O período anterior cobre o mesmo trecho, para não comparar mês parcial com mês cheio. */
export function intervaloDoPeriodo(periodo: PeriodoDashboard, agora = new Date()): IntervaloDashboard {
  if (periodo === "30d") {
    const de = new Date(agora.getTime() - 30 * 86_400_000);
    return {
      de,
      ate: agora,
      deAnterior: new Date(de.getTime() - 30 * 86_400_000),
      ateAnterior: de,
    };
  }
  if (periodo === "ano") {
    const de = new Date(agora.getFullYear(), 0, 1);
    const ateAnterior = new Date(agora);
    ateAnterior.setFullYear(agora.getFullYear() - 1);
    return { de, ate: agora, deAnterior: new Date(agora.getFullYear() - 1, 0, 1), ateAnterior };
  }
  const de = new Date(agora.getFullYear(), agora.getMonth(), 1);
  return {
    de,
    ate: agora,
    deAnterior: new Date(agora.getFullYear(), agora.getMonth() - 1, 1),
    ateAnterior: deslocarMeses(agora, -1),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function contar(tabela: string, filtrar: (q: any) => any = (q) => q): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = (supabase as any).from(tabela).select("id", { count: "exact", head: true });
  const { count, error } = await filtrar(base);
  if (error) throw error;
  return (count as number | null) ?? 0;
}

function emIntervalo(valor: string | null, de: Date, ate: Date): boolean {
  if (!valor) return false;
  const t = new Date(valor).getTime();
  return t >= de.getTime() && t < ate.getTime();
}

function diaEmIntervalo(dia: string | null, de: Date, ate: Date): boolean {
  if (!dia) return false;
  const d = dia.slice(0, 10);
  return d >= isoDia(de) && d <= isoDia(ate);
}

async function carregarVendas(intervalo: IntervaloDashboard) {
  const agora = new Date();
  const inicioHistorico = new Date(agora.getFullYear(), agora.getMonth() - (MESES_HISTORICO - 1), 1);
  const desde = intervalo.deAnterior < inicioHistorico ? intervalo.deAnterior : inicioHistorico;

  const { data, error } = await supabase
    .from("vendas")
    .select("regiao_venda, moeda_venda, valor_total, data_pedido")
    .neq("status_venda", "cancelado")
    .gte("data_pedido", desde.toISOString())
    .limit(20000);
  if (error) throw error;

  const porChave = new Map<string, ResumoVendasRegiao>();
  const meses = new Map<string, MesHistorico>();
  for (let i = MESES_HISTORICO - 1; i >= 0; i--) {
    const mes = chaveMes(new Date(agora.getFullYear(), agora.getMonth() - i, 1));
    meses.set(mes, { mes, porRegiao: {} });
  }

  for (const v of data ?? []) {
    const chave = `${v.regiao_venda}|${v.moeda_venda}`;
    const resumo =
      porChave.get(chave) ??
      ({
        regiao: v.regiao_venda,
        moeda: v.moeda_venda,
        faturamento: 0,
        vendas: 0,
        faturamentoAnterior: 0,
        vendasAnterior: 0,
      } satisfies ResumoVendasRegiao);
    const valor = Number(v.valor_total) || 0;
    if (emIntervalo(v.data_pedido, intervalo.de, intervalo.ate)) {
      resumo.faturamento += valor;
      resumo.vendas += 1;
    } else if (emIntervalo(v.data_pedido, intervalo.deAnterior, intervalo.ateAnterior)) {
      resumo.faturamentoAnterior += valor;
      resumo.vendasAnterior += 1;
    }
    porChave.set(chave, resumo);

    if (v.data_pedido) {
      const mes = meses.get(chaveMes(new Date(v.data_pedido)));
      if (mes) mes.porRegiao[v.regiao_venda] = (mes.porRegiao[v.regiao_venda] ?? 0) + 1;
    }
  }

  return { vendas: [...porChave.values()], historico: [...meses.values()] };
}

async function carregarFinanceiro(intervalo: IntervaloDashboard): Promise<ResumoFinanceiroRegiao[]> {
  const [abertas, recebidas] = await Promise.all([
    supabase
      .from("contas_receber")
      .select("moeda, valor, data_vencimento, venda:vendas!inner(regiao_venda)")
      .eq("situacao", "aberto")
      .limit(20000),
    supabase
      .from("contas_receber")
      .select("moeda, valor, valor_recebido, data_recebimento, venda:vendas!inner(regiao_venda)")
      .eq("situacao", "recebido")
      .gte("data_recebimento", isoDia(intervalo.deAnterior))
      .limit(20000),
  ]);
  if (abertas.error) throw abertas.error;
  if (recebidas.error) throw recebidas.error;

  const hoje = isoDia(new Date());
  const porChave = new Map<string, ResumoFinanceiroRegiao>();
  const obter = (regiao: TipoRegiao, moeda: string) => {
    const chave = `${regiao}|${moeda}`;
    let r = porChave.get(chave);
    if (!r) {
      r = { regiao, moeda, recebido: 0, recebidoAnterior: 0, emAberto: 0, vencido: 0, quantidadeVencida: 0 };
      porChave.set(chave, r);
    }
    return r;
  };

  type ComVenda = { venda: { regiao_venda: TipoRegiao } | null };
  for (const c of (abertas.data ?? []) as unknown as Array<ComVenda & { moeda: string; valor: number; data_vencimento: string | null }>) {
    const r = obter(c.venda?.regiao_venda ?? "outros", c.moeda);
    const valor = Number(c.valor) || 0;
    r.emAberto += valor;
    if (c.data_vencimento && c.data_vencimento.slice(0, 10) < hoje) {
      r.vencido += valor;
      r.quantidadeVencida += 1;
    }
  }
  for (const c of (recebidas.data ?? []) as unknown as Array<
    ComVenda & { moeda: string; valor: number; valor_recebido: number | null; data_recebimento: string | null }
  >) {
    const r = obter(c.venda?.regiao_venda ?? "outros", c.moeda);
    const valor = Number(c.valor_recebido ?? c.valor) || 0;
    if (diaEmIntervalo(c.data_recebimento, intervalo.de, intervalo.ate)) r.recebido += valor;
    else if (diaEmIntervalo(c.data_recebimento, intervalo.deAnterior, intervalo.ateAnterior)) {
      r.recebidoAnterior += valor;
    }
  }
  return [...porChave.values()];
}

async function carregarEstoque(): Promise<ResumoEstoqueRegiao[]> {
  const { data, error } = await supabase
    .from("itens_estoque")
    .select("preco_venda, moeda_venda, local:locais_estoque(tipo_regiao)")
    .eq("status_item", "em_estoque")
    .limit(20000);
  if (error) throw error;

  const porRegiao = new Map<ResumoEstoqueRegiao["regiao"], ResumoEstoqueRegiao>();
  for (const it of (data ?? []) as unknown as Array<{
    preco_venda: number | null;
    moeda_venda: string | null;
    local: { tipo_regiao: TipoRegiao } | null;
  }>) {
    const regiao = it.local?.tipo_regiao ?? "sem_local";
    const r = porRegiao.get(regiao) ?? { regiao, pares: 0, valorPorMoeda: {} };
    r.pares += 1;
    if (it.preco_venda && it.moeda_venda) {
      r.valorPorMoeda[it.moeda_venda] = (r.valorPorMoeda[it.moeda_venda] ?? 0) + Number(it.preco_venda);
    }
    porRegiao.set(regiao, r);
  }
  return [...porRegiao.values()].sort((a, b) => b.pares - a.pares);
}

async function carregarAndamento(): Promise<DashboardResumo["andamento"]> {
  const { data, error } = await supabase
    .from("vendas")
    .select("status_venda, regiao_venda")
    .in("status_venda", STATUS_ANDAMENTO)
    .limit(20000);
  if (error) throw error;
  const andamento = Object.fromEntries(STATUS_ANDAMENTO.map((s) => [s, {}])) as DashboardResumo["andamento"];
  for (const v of data ?? []) {
    const linha = andamento[v.status_venda as StatusAndamento];
    linha[v.regiao_venda] = (linha[v.regiao_venda] ?? 0) + 1;
  }
  return andamento;
}

async function carregarPendencias(): Promise<PendenciasDashboard> {
  const [
    avisosNaoLidos,
    contasDivergentes,
    fretePendente,
    alertasVitrine,
    conferenciasAbertas,
    carrinhosAbertos,
    itensReservados,
    itensTransferencia,
    itensEmCompra,
  ] = await Promise.all([
    contar("avisos", (q) => q.eq("lido", false)),
    contar("contas_receber", (q) => q.eq("situacao", "aberto").eq("divergente", true)),
    contar("vendas", (q) => q.eq("frete_status", "pendente").neq("status_venda", "cancelado")),
    vitrinesService.contarAlertasAtual().catch(() => 0),
    contar("conferencias", (q) => q.eq("status", "aberta")),
    contar("carrinhos_galeria", (q) => q.eq("status", "aberto")),
    contar("itens_estoque", (q) => q.eq("status_item", "reservado")),
    contar("itens_estoque", (q) => q.eq("status_item", "transferencia")),
    contar("itens_estoque", (q) => q.eq("status_item", "em_processo_de_compra")),
  ]);
  return {
    avisosNaoLidos,
    contasDivergentes,
    fretePendente,
    alertasVitrine,
    conferenciasAbertas,
    carrinhosAbertos,
    itensReservados,
    itensTransferencia,
    itensEmCompra,
  };
}

async function carregarMaisVendidos(intervalo: IntervaloDashboard, limite = 5): Promise<ModeloMaisVendido[]> {
  const { data, error } = await supabase
    .from("itens_venda")
    .select(
      `quantidade, descricao,
       item_estoque:itens_estoque(id_modelo_produto, modelo:modelos_produto(id, nome_modelo)),
       venda:vendas!inner(data_pedido, status_venda)`,
    )
    .gte("venda.data_pedido", intervalo.de.toISOString())
    .lte("venda.data_pedido", intervalo.ate.toISOString())
    .neq("venda.status_venda", "cancelado")
    .limit(20000);
  if (error) throw error;

  const porModelo = new Map<string, ModeloMaisVendido>();
  for (const it of (data ?? []) as unknown as Array<{
    quantidade: number;
    descricao: string | null;
    item_estoque: { id_modelo_produto: string | null; modelo: { id: string; nome_modelo: string } | null } | null;
  }>) {
    const modelo = it.item_estoque?.modelo ?? null;
    const nome = modelo?.nome_modelo ?? it.descricao?.trim() ?? "Sem descrição";
    const chave = modelo?.id ?? `desc:${nome.toLowerCase()}`;
    const atual = porModelo.get(chave) ?? { chave, idModelo: modelo?.id ?? null, nome, pares: 0 };
    atual.pares += Number(it.quantidade) || 0;
    porModelo.set(chave, atual);
  }
  return [...porModelo.values()].sort((a, b) => b.pares - a.pares).slice(0, limite);
}

async function carregarLinks(intervalo: IntervaloDashboard): Promise<ResumoLinksPedido> {
  const agora = new Date().toISOString();
  const [links, vendasLink, linksAtivos] = await Promise.all([
    supabase
      .from("links_pedido")
      .select("criado_em, acessos, vendas_confirmadas")
      .gte("criado_em", intervalo.deAnterior.toISOString())
      .limit(20000),
    supabase
      .from("links_pedido_vendas")
      .select("criado_em, venda:vendas!inner(valor_total, moeda_venda, status_venda)")
      .gte("criado_em", intervalo.deAnterior.toISOString())
      .neq("venda.status_venda", "cancelado")
      .limit(20000),
    contar("links_pedido", (q) => q.eq("status", "ativo").gt("validade_em", agora)),
  ]);
  if (links.error) throw links.error;
  if (vendasLink.error) throw vendasLink.error;

  const resumo: ResumoLinksPedido = {
    linksAtivos,
    linksCriados: 0,
    linksCriadosAnterior: 0,
    linksComVenda: 0,
    acessos: 0,
    vendas: 0,
    vendasAnterior: 0,
    faturamentoPorMoeda: {},
  };
  for (const l of links.data ?? []) {
    if (emIntervalo(l.criado_em, intervalo.de, intervalo.ate)) {
      resumo.linksCriados += 1;
      resumo.acessos += Number(l.acessos) || 0;
      if (l.vendas_confirmadas > 0) resumo.linksComVenda += 1;
    } else if (emIntervalo(l.criado_em, intervalo.deAnterior, intervalo.ateAnterior)) {
      resumo.linksCriadosAnterior += 1;
    }
  }
  for (const lv of (vendasLink.data ?? []) as unknown as Array<{
    criado_em: string;
    venda: { valor_total: number; moeda_venda: string } | null;
  }>) {
    if (emIntervalo(lv.criado_em, intervalo.de, intervalo.ate)) {
      resumo.vendas += 1;
      if (lv.venda) {
        resumo.faturamentoPorMoeda[lv.venda.moeda_venda] =
          (resumo.faturamentoPorMoeda[lv.venda.moeda_venda] ?? 0) + (Number(lv.venda.valor_total) || 0);
      }
    } else if (emIntervalo(lv.criado_em, intervalo.deAnterior, intervalo.ateAnterior)) {
      resumo.vendasAnterior += 1;
    }
  }
  return resumo;
}

export const dashboardService = {
  async carregarResumo(periodo: PeriodoDashboard): Promise<DashboardResumo> {
    const intervalo = intervaloDoPeriodo(periodo);
    const [vendas, financeiro, estoque, pendencias, andamento, maisVendidos, links] = await Promise.all([
      carregarVendas(intervalo),
      carregarFinanceiro(intervalo),
      carregarEstoque(),
      carregarPendencias(),
      carregarAndamento(),
      carregarMaisVendidos(intervalo),
      carregarLinks(intervalo),
    ]);
    return {
      links,
      vendas: vendas.vendas,
      historico: vendas.historico,
      financeiro,
      estoque,
      pendencias,
      andamento,
      maisVendidos,
    };
  },

  async ultimasVendas(limite = 6): Promise<VendaRecente[]> {
    const { data, error } = await supabase
      .from("vendas")
      .select("id, numero, nome_cliente, regiao_venda, moeda_venda, status_venda, valor_total, data_pedido")
      .order("data_pedido", { ascending: false, nullsFirst: false })
      .order("criado_em", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return (data ?? []) as VendaRecente[];
  },
};
