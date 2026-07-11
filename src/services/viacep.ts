export interface ViaCepEndereco {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export function normalizarCep(cep: string): string {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function formatarCep(cep: string): string {
  const digitos = normalizarCep(cep);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

export async function buscarEnderecoPorCep(cep: string): Promise<ViaCepEndereco | null> {
  const digitos = normalizarCep(cep);
  if (digitos.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP.");

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro || !data.localidade) return null;

  return {
    cep: formatarCep(data.cep ?? digitos),
    logradouro: data.logradouro?.trim() ?? "",
    complemento: data.complemento?.trim() ?? "",
    bairro: data.bairro?.trim() ?? "",
    cidade: data.localidade?.trim() ?? "",
    uf: data.uf?.trim() ?? "",
  };
}
