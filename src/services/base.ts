import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import type { PaginatedResult, PaginationParams } from "../types/entities";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

type AnyClient = {
  from: (table: string) => {
    select: (columns: string, opts?: { count?: "exact"; head?: boolean }) => any;
    insert: (values: unknown) => any;
    update: (values: unknown) => any;
    delete: () => any;
  };
};

const sb = supabase as unknown as AnyClient;

export interface ListConfig {
  searchColumns?: string[];
  defaultOrderBy?: string;
  defaultAscending?: boolean;
  filters?: Record<string, string | number | boolean | null | undefined>;
}

export async function listar<T extends TableName>(
  tabela: T,
  params: PaginationParams = {},
  config: ListConfig = {},
): Promise<PaginatedResult<Tables[T]["Row"]>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const orderBy = params.orderBy ?? config.defaultOrderBy ?? "criado_em";
  const ascending = params.ascending ?? config.defaultAscending ?? false;

  let query = sb.from(tabela as string).select("*", { count: "exact" });

  if (config.filters) {
    for (const [coluna, valor] of Object.entries(config.filters)) {
      if (valor === undefined || valor === null || valor === "") continue;
      query = query.eq(coluna, valor);
    }
  }

  const termo = params.search?.trim();
  if (termo && config.searchColumns && config.searchColumns.length > 0) {
    const padrao = `%${termo.replace(/%/g, "").replace(/,/g, " ")}%`;
    const ors = config.searchColumns.map((col) => `${col}.ilike.${padrao}`).join(",");
    query = query.or(ors);
  }

  query = query.order(orderBy, { ascending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data ?? []) as Tables[T]["Row"][],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function obterPorId<T extends TableName>(
  tabela: T,
  id: string,
): Promise<Tables[T]["Row"] | null> {
  const { data, error } = await sb
    .from(tabela as string)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Tables[T]["Row"] | null;
}

export async function inserir<T extends TableName>(
  tabela: T,
  registro: Tables[T]["Insert"],
): Promise<Tables[T]["Row"]> {
  const { data, error } = await sb
    .from(tabela as string)
    .insert(registro)
    .select("*")
    .single();
  if (error) throw error;
  return data as Tables[T]["Row"];
}

export async function atualizar<T extends TableName>(
  tabela: T,
  id: string,
  patch: Tables[T]["Update"],
): Promise<Tables[T]["Row"]> {
  const { data, error } = await sb
    .from(tabela as string)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Tables[T]["Row"];
}

export async function deletar<T extends TableName>(
  tabela: T,
  id: string,
): Promise<void> {
  const { error } = await sb.from(tabela as string).delete().eq("id", id);
  if (error) throw error;
}

export async function contar<T extends TableName>(
  tabela: T,
  filtros: Record<string, string | number | boolean | null> = {},
): Promise<number> {
  let q = sb.from(tabela as string).select("id", { count: "exact", head: true });
  for (const [coluna, valor] of Object.entries(filtros)) {
    if (valor === null || valor === undefined) continue;
    q = q.eq(coluna, valor);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
