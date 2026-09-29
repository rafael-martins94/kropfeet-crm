import { supabase } from "../lib/supabase";
import type { ContaReceber, SituacaoContaReceber, TipoRegiao } from "../types/entities";
import { padraoIlikePostgrest } from "../utils/postgrestFilter";
import { contaContaComoEmAberto, contaContaComoRecebida } from "../utils/situacaoContaExibida";

export interface ContaReceberDetalhada extends ContaReceber {
  /** Data em que a SumUp pagou o repasse. Nula quando ainda não houve pagamento. */
  data_pagamento_sumup: string | null;
  venda?: { id: string; numero: string | null; regiao_venda: TipoRegiao; nome_cliente: string | null } | null;
  cliente?: { id: string; nome: string } | null;
}

export type SituacaoFiltroConta = SituacaoContaReceber | "vencida" | "divergente" | "";
export type SituacaoFiltroValor = Exclude<SituacaoFiltroConta, "">;

/** Valor do filtro para contas com `meio_pagamento` nulo. */
export const MEIO_SEM_PAGAMENTO = "__sem_meio__";
/** Valor do filtro para contas com `forma_pagamento` nula. */
export const FORMA_SEM_PAGAMENTO = "__sem_forma__";

export type RegiaoContasReceber = "brasil" | "europa";

export type FiltroContasReceber = {
  /** Vazio significa todas as situações. */
  situacoes?: SituacaoFiltroValor[];
  regiao?: RegiaoContasReceber;
  moeda?: string;
  /** Vazio significa todas as formas. Inclui `FORMA_SEM_PAGAMENTO`. */
  formas?: string[];
  /** Vazio significa todos os meios. Inclui `MEIO_SEM_PAGAMENTO`. */
  meios?: string[];
  /** ISO YYYY-MM-DD — vencimento */
  de?: string | null;
  ate?: string | null;
  vencidas?: boolean;
  divergentes?: boolean;
  busca?: string;
};

export type TotaisContasReceber = Record<
  string,
  { emAberto: number; vencido: number; recebido: number; quantidadeAberta: number }
>;

const SELECT_DETALHADO = `*, data_pagamento_sumup,
  venda:vendas!inner(id, numero, regiao_venda, nome_cliente),
  cliente:clientes(id, nome)`;

const SELECT_TOTAIS = `moeda, situacao, valor, valor_recebido, data_vencimento, data_recebimento, origem_baixa, forma_pagamento, meio_pagamento, codigo_transacao, criado_em, atualizado_em,
  venda:vendas!inner(regiao_venda)`;

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function idsClientesPorNome(termo: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id")
    .ilike("nome", `%${termo.replace(/%/g, "")}%`)
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((c) => c.id);
}

/** Ids de clientes que casam com a busca; resolvido antes de montar a query. */
async function clientesDaBusca(filtro: FiltroContasReceber): Promise<string[]> {
  const termo = filtro.busca?.trim();
  return termo ? idsClientesPorNome(termo) : [];
}

/**
 * Síncrona de propósito: o builder do PostgREST é "thenable", e devolvê-lo de uma função
 * async faria o `await` executar a consulta antes do order/range.
 */
function citarFiltro(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

function aplicarListaOuNulo<Q>(query: Q, coluna: string, valores: string[], sentinelaVazio: string): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  const semValor = valores.includes(sentinelaVazio);
  const nomes = valores.filter((valor) => valor !== sentinelaVazio);
  if (!semValor && nomes.length === 0) return q as Q;
  if (semValor && nomes.length === 0) return q.is(coluna, null) as Q;
  if (!semValor) return q.in(coluna, nomes) as Q;
  const lista = nomes.map(citarFiltro).join(",");
  return q.or(`${coluna}.is.null,${coluna}.in.(${lista})`) as Q;
}

function aplicarSituacoes<Q>(query: Q, situacoes: SituacaoFiltroValor[]): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  const partes = situacoes.map((situacao) =>
    situacao === "divergente"
      ? "divergente.eq.true"
      : `and(situacao_exibida.eq.${situacao},divergente.eq.false)`,
  );
  if (partes.length === 0) return q as Q;
  return q.or(partes.join(",")) as Q;
}

function aplicarFiltros<Q>(
  query: Q,
  filtro: FiltroContasReceber,
  incluirSituacao: boolean,
  clientes: string[],
): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  if (incluirSituacao && filtro.situacoes && filtro.situacoes.length > 0) {
    q = aplicarSituacoes(q, filtro.situacoes);
  }
  if (filtro.regiao) q = q.eq("venda.regiao_venda", filtro.regiao);
  if (filtro.moeda) q = q.eq("moeda", filtro.moeda);
  if (filtro.formas && filtro.formas.length > 0) {
    q = aplicarListaOuNulo(q, "forma_pagamento", filtro.formas, FORMA_SEM_PAGAMENTO);
  }
  if (filtro.meios && filtro.meios.length > 0) {
    q = aplicarListaOuNulo(q, "meio_pagamento", filtro.meios, MEIO_SEM_PAGAMENTO);
  }
  if (filtro.de) q = q.gte("data_vencimento", filtro.de);
  if (filtro.ate) q = q.lte("data_vencimento", filtro.ate);
  if (filtro.vencidas) q = q.eq("situacao", "aberto").lt("data_vencimento", hojeIso());
  if (filtro.divergentes) q = q.eq("divergente", true);

  const termo = filtro.busca?.trim();
  if (termo) {
    const padrao = padraoIlikePostgrest(termo);
    const partes = [`documento.ilike.${padrao}`, `codigo_transacao.ilike.${padrao}`];
    if (clientes.length > 0) partes.push(`id_cliente.in.(${clientes.join(",")})`);
    q = q.or(partes.join(","));
  }
  return q as Q;
}

export const contasReceberService = {
  listarPorVenda: async (idVenda: string): Promise<ContaReceberDetalhada[]> => {
    const { data, error } = await supabase
      .from("contas_receber")
      .select("*, data_pagamento_sumup")
      .eq("id_venda", idVenda)
      .order("data_vencimento", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ContaReceberDetalhada[];
  },

  listar: async (
    filtro: FiltroContasReceber,
    paginacao: { page: number; pageSize: number },
  ): Promise<{ data: ContaReceberDetalhada[]; total: number }> => {
    const clientes = await clientesDaBusca(filtro);
    const query = aplicarFiltros(
      supabase.from("contas_receber").select(SELECT_DETALHADO, { count: "exact" }),
      filtro,
      true,
      clientes,
    );
    const from = (paginacao.page - 1) * paginacao.pageSize;
    const { data, error, count } = await query
      .order("data_vencimento", {
        ascending: !(filtro.situacoes?.length === 1 && filtro.situacoes[0] === "recebido"),
        nullsFirst: false,
      })
      .order("documento", { ascending: true })
      .range(from, from + paginacao.pageSize - 1);
    if (error) throw error;
    return { data: (data ?? []) as unknown as ContaReceberDetalhada[], total: count ?? 0 };
  },

  /** Totais por moeda com os mesmos filtros, ignorando o filtro de situação. */
  totais: async (filtro: FiltroContasReceber): Promise<TotaisContasReceber> => {
    const clientes = await clientesDaBusca(filtro);
    const query = aplicarFiltros(
      supabase
        .from("contas_receber")
        .select(SELECT_TOTAIS),
      { ...filtro, vencidas: false },
      false,
      clientes,
    );
    const { data, error } = await query.neq("situacao", "cancelado").limit(20000);
    if (error) throw error;

    const hoje = hojeIso();
    const totais: TotaisContasReceber = {};
    for (const c of data ?? []) {
      const t = (totais[c.moeda] ??= { emAberto: 0, vencido: 0, recebido: 0, quantidadeAberta: 0 });
      if (contaContaComoRecebida(c)) {
        t.recebido += Number(c.valor_recebido ?? c.valor) || 0;
      } else if (contaContaComoEmAberto(c)) {
        t.emAberto += Number(c.valor) || 0;
        t.quantidadeAberta += 1;
        if (c.situacao === "aberto" && c.data_vencimento && c.data_vencimento < hoje) {
          t.vencido += Number(c.valor) || 0;
        }
      }
    }
    return totais;
  },

  /** Sem data, cada conta é baixada na própria data de vencimento. */
  baixar: async (ids: string[], dataRecebimento: string | null): Promise<number> => {
    const { data, error } = await supabase.rpc("baixar_contas_receber", {
      p_ids: ids,
      p_data_recebimento: dataRecebimento,
    });
    if (error) throw error;
    return Number(data ?? 0);
  },

  estornarBaixa: async (ids: string[]): Promise<number> => {
    const { data, error } = await supabase.rpc("estornar_baixa_contas_receber", { p_ids: ids });
    if (error) throw error;
    return Number(data ?? 0);
  },

};

export function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const data = new Date(y, m - 1, d + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
