import type { Database } from "../../../tipos/database.js";
import type { SupabaseAppClient } from "../clienteSupabase.js";

type EnderecoInsert = Database["public"]["Tables"]["enderecos_cliente"]["Insert"];

export interface DadosEnderecoCliente {
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  pais?: string | null;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function normalizarCep(cep: string | null | undefined): string {
  return (cep ?? "").replace(/\D/g, "");
}

function chaveEndereco(e: DadosEnderecoCliente): string {
  return [normalizarCep(e.cep), norm(e.endereco), norm(e.numero)].join("|");
}

function enderecoTemDados(e: DadosEnderecoCliente): boolean {
  return Boolean(
    norm(e.cep) || norm(e.endereco) || norm(e.cidade) || norm(e.bairro),
  );
}

export async function obterOuCriarEnderecoPorDados(
  supabase: SupabaseAppClient,
  idCliente: string,
  dados: DadosEnderecoCliente,
  rotulo = "Entrega",
): Promise<string | null> {
  if (!enderecoTemDados(dados)) return null;

  const existentes = await supabase
    .from("enderecos_cliente")
    .select("id, cep, endereco, numero, principal")
    .eq("id_cliente", idCliente);

  if (existentes.error) throw existentes.error;

  const chave = chaveEndereco(dados);
  const match = (existentes.data ?? []).find((e) => chaveEndereco(e) === chave);
  if (match) return match.id;

  const principal = (existentes.data ?? []).length === 0;
  const payload: EnderecoInsert = {
    id_cliente: idCliente,
    rotulo,
    principal,
    cep: dados.cep?.trim() || null,
    endereco: dados.endereco?.trim() || null,
    numero: dados.numero?.trim() || null,
    complemento: dados.complemento?.trim() || null,
    bairro: dados.bairro?.trim() || null,
    cidade: dados.cidade?.trim() || null,
    uf: dados.uf?.trim() || null,
    pais: dados.pais?.trim() || "Brasil",
  };

  const inserido = await supabase
    .from("enderecos_cliente")
    .insert(payload)
    .select("id")
    .single();

  if (inserido.error) throw inserido.error;
  return inserido.data.id;
}
