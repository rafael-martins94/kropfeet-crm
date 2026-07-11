export interface OpcaoSimples {
  value: string;
  label: string;
}

export const tipoPessoaOpcoes: OpcaoSimples[] = [
  { value: "fisica", label: "Pessoa física" },
  { value: "juridica", label: "Pessoa jurídica" },
];

/** Países usados no cadastro/importação de clientes. */
export const paisClienteOpcoes: OpcaoSimples[] = [
  { value: "Brasil", label: "Brasil" },
  { value: "Europa", label: "Europa" },
];

/** Unidades federativas do Brasil. */
export const ufOpcoes: OpcaoSimples[] = [
  { value: "AC", label: "AC — Acre" },
  { value: "AL", label: "AL — Alagoas" },
  { value: "AP", label: "AP — Amapá" },
  { value: "AM", label: "AM — Amazonas" },
  { value: "BA", label: "BA — Bahia" },
  { value: "CE", label: "CE — Ceará" },
  { value: "DF", label: "DF — Distrito Federal" },
  { value: "ES", label: "ES — Espírito Santo" },
  { value: "GO", label: "GO — Goiás" },
  { value: "MA", label: "MA — Maranhão" },
  { value: "MT", label: "MT — Mato Grosso" },
  { value: "MS", label: "MS — Mato Grosso do Sul" },
  { value: "MG", label: "MG — Minas Gerais" },
  { value: "PA", label: "PA — Pará" },
  { value: "PB", label: "PB — Paraíba" },
  { value: "PR", label: "PR — Paraná" },
  { value: "PE", label: "PE — Pernambuco" },
  { value: "PI", label: "PI — Piauí" },
  { value: "RJ", label: "RJ — Rio de Janeiro" },
  { value: "RN", label: "RN — Rio Grande do Norte" },
  { value: "RS", label: "RS — Rio Grande do Sul" },
  { value: "RO", label: "RO — Rondônia" },
  { value: "RR", label: "RR — Roraima" },
  { value: "SC", label: "SC — Santa Catarina" },
  { value: "SP", label: "SP — São Paulo" },
  { value: "SE", label: "SE — Sergipe" },
  { value: "TO", label: "TO — Tocantins" },
];

export function opcoesComValorAtual(
  base: OpcaoSimples[],
  valorAtual: string,
  vazioLabel: string,
): OpcaoSimples[] {
  const opcoes: OpcaoSimples[] = [{ value: "", label: vazioLabel }, ...base];
  if (valorAtual && !opcoes.some((o) => o.value === valorAtual)) {
    opcoes.push({ value: valorAtual, label: valorAtual });
  }
  return opcoes;
}
