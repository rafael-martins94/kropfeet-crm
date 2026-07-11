export interface DadosEndereco {
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

export function chaveEndereco(e: DadosEndereco): string {
  return [norm(e.cep), norm(e.endereco), norm(e.numero)].join("|");
}

export function enderecoTemDados(e: DadosEndereco): boolean {
  return Boolean(
    norm(e.cep) || norm(e.endereco) || norm(e.cidade) || norm(e.bairro),
  );
}

export function formatarEnderecoLinha(e: DadosEndereco): string {
  return [e.endereco, e.numero, e.complemento].filter(Boolean).join(", ");
}

export function formatarLocalidade(e: DadosEndereco): string {
  return [e.cidade, e.uf].filter(Boolean).join(" · ");
}

export function formatarEnderecoOpcao(
  e: DadosEndereco & { rotulo?: string | null; principal?: boolean },
): string {
  const titulo = e.rotulo?.trim() || (e.principal ? "Principal" : "Endereço");
  const detalhe = [formatarEnderecoLinha(e), formatarLocalidade(e)].filter(Boolean).join(" · ");
  return detalhe ? `${titulo} — ${detalhe}` : titulo;
}
