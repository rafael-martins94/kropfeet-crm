import type { TipoPessoa } from "../types/entities";

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function formatarCpf(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCnpj(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatarDocumento(valor: string, tipo: TipoPessoa | "" | null | undefined): string {
  if (tipo === "juridica") return formatarCnpj(valor);
  if (tipo === "fisica") return formatarCpf(valor);
  const digitos = apenasDigitos(valor);
  return digitos.length > 11 ? formatarCnpj(digitos) : formatarCpf(digitos);
}

export function inferirTipoPessoa(cpfCnpj: string | null | undefined): TipoPessoa | "" {
  const digitos = apenasDigitos(cpfCnpj ?? "");
  if (digitos.length === 14) return "juridica";
  if (digitos.length === 11) return "fisica";
  return "";
}

export function labelDocumento(tipo: TipoPessoa | "" | null | undefined): string {
  if (tipo === "juridica") return "CNPJ";
  if (tipo === "fisica") return "CPF";
  return "CPF / CNPJ";
}

export function labelNome(tipo: TipoPessoa | "" | null | undefined): string {
  if (tipo === "juridica") return "Razão social";
  if (tipo === "fisica") return "Nome completo";
  return "Nome";
}
