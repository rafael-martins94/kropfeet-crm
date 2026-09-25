import { supabase } from "../lib/supabase";
import type { Json, Database } from "../types/database";
import type { PaginatedResult, PaginationParams } from "../types/entities";

export type SituacaoCarrinhoGaleria = "todos" | "salvo" | "com_ordem";

export type ItemCarrinhoGaleria = {
  id?: string;
  sku?: string;
  numeracao?: string;
  preco?: string | null;
};

type VendaResumo = Pick<
  Database["public"]["Tables"]["vendas"]["Row"],
  "id" | "numero" | "status_venda" | "valor_total" | "moeda_venda"
>;

type ClienteResumo = Pick<
  Database["public"]["Tables"]["clientes"]["Row"],
  "id" | "nome" | "telefone" | "email" | "pais"
>;

export type CarrinhoGaleriaLista = {
  id: string;
  criado_em: string;
  itens: ItemCarrinhoGaleria[];
  observacao: string | null;
  id_cliente: string;
  id_venda: string | null;
  cliente: ClienteResumo | null;
  venda: VendaResumo | null;
};

const selecao = `
  id, criado_em, itens, observacao, id_cliente, id_venda,
  cliente:clientes(id, nome, telefone, email, pais),
  venda:vendas(id, numero, status_venda, valor_total, moeda_venda)
`;

function lerItens(valor: Json): ItemCarrinhoGaleria[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const linha = item as Record<string, Json | undefined>;
    return [
      {
        id: typeof linha.id === "string" ? linha.id : undefined,
        sku: typeof linha.sku === "string" ? linha.sku : undefined,
        numeracao: typeof linha.numeracao === "string" ? linha.numeracao : undefined,
        preco: typeof linha.preco === "string" ? linha.preco : null,
      },
    ];
  });
}

function um<T>(valor: T | T[] | null): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

export const carrinhosGaleriaService = {
  listar: async (
    params?: PaginationParams & { situacao?: SituacaoCarrinhoGaleria },
  ): Promise<PaginatedResult<CarrinhoGaleriaLista> & { salvos: number; comOrdem: number }> => {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const termo = params?.search?.trim();
    const situacao = params?.situacao ?? "todos";
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const aplicarBusca = <T extends { ilike: (coluna: string, padrao: string) => T }>(query: T) =>
      termo ? query.ilike("busca", `%${termo}%`) : query;

    const aplicarSituacao = <
      T extends {
        is: (coluna: string, valor: null) => T;
        not: (coluna: string, operador: string, valor: null) => T;
      },
    >(
      query: T,
      filtro: SituacaoCarrinhoGaleria,
    ) => {
      if (filtro === "salvo") return query.is("id_venda", null);
      if (filtro === "com_ordem") return query.not("id_venda", "is", null);
      return query;
    };

    let lista = supabase
      .from("carrinhos_galeria")
      .select(selecao, { count: "exact" })
      .order("criado_em", { ascending: false });
    lista = aplicarBusca(lista);
    lista = aplicarSituacao(lista, situacao);

    let salvosQuery = supabase
      .from("carrinhos_galeria")
      .select("id", { count: "exact", head: true })
      .is("id_venda", null);
    salvosQuery = aplicarBusca(salvosQuery);

    let ordensQuery = supabase
      .from("carrinhos_galeria")
      .select("id", { count: "exact", head: true })
      .not("id_venda", "is", null);
    ordensQuery = aplicarBusca(ordensQuery);

    const [listaRes, salvosRes, ordensRes] = await Promise.all([
      lista.range(from, to),
      salvosQuery,
      ordensQuery,
    ]);

    if (listaRes.error) throw listaRes.error;
    if (salvosRes.error) throw salvosRes.error;
    if (ordensRes.error) throw ordensRes.error;

    const data = (listaRes.data ?? []).map((row) => {
      const item = row as unknown as Omit<CarrinhoGaleriaLista, "itens" | "cliente" | "venda"> & {
        itens: Json;
        cliente: ClienteResumo | ClienteResumo[] | null;
        venda: VendaResumo | VendaResumo[] | null;
      };
      return {
        ...item,
        itens: lerItens(item.itens),
        cliente: um(item.cliente),
        venda: um(item.venda),
      };
    });

    return {
      data,
      total: listaRes.count ?? 0,
      page,
      pageSize,
      salvos: salvosRes.count ?? 0,
      comOrdem: ordensRes.count ?? 0,
    };
  },
};
