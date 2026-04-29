/** Erros do Supabase/PostgREST nem sempre são `instanceof Error`; evita `[object Object]` na UI. */
export function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Traduz 409 / violação de UNIQUE em `modelos_produto` para texto útil no formulário. */
export function mensagemErroSalvarModeloProduto(e: unknown): string {
  const raw = mensagemErro(e);
  const m = raw.toLowerCase();
  if (m.includes("modelos_produto_nome_marca_unique")) {
    return (
      "Já existe outro modelo com o mesmo nome para a marca selecionada. " +
      "Altere o nome do modelo ou use a marca que já está no cadastro da duplicata."
    );
  }
  if (m.includes("modelos_produto_nome_sem_marca_unique")) {
    return (
      "Já existe outro modelo com o mesmo nome sem marca definida. " +
      "Altere o nome ou associe uma marca que diferencie os dois."
    );
  }
  if (m.includes("modelos_produto_slug_unico")) {
    return "Já existe outro modelo com este slug. Ajuste o campo slug.";
  }
  if (m.includes("modelos_produto_codigo_referencia_unico")) {
    return "Já existe outro modelo com este código de referência.";
  }
  if (m.includes("modelos_produto_id_tiny_pai_unico")) {
    return "Outro modelo já está vinculado a este produto pai no Tiny.";
  }
  return raw;
}
