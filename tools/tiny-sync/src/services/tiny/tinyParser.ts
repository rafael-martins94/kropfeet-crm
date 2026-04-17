import { gerarSlug, normalizarTexto, paraDataApenas, paraDataIso, paraNumeroOuNulo } from "../../utils/normalizacao.js";
import { parseNomeProdutoTiny } from "../../utils/parseNumeracao.js";
import type { TinyProdutoDetalhe } from "./tinyTipos.js";

export interface ImagemParseada {
  url: string;
  hash: string | null;
}

export interface DadosFornecedorParseados {
  idTiny: string | null;
  nome: string | null;
  codigoFornecedor: string | null;
  codigoPeloFornecedor: string | null;
}

export interface DadosLocalEstoqueParseado {
  codigo: string;
  nome: string;
  tipoRegiao: "brasil" | "europa" | "outros";
}

export interface DadosModeloParseados {
  nomeModelo: string;
  slug: string;
  idTinyPai: string | null;
  codigoFabricante: string | null;
  descricao: string | null;
  marca: string | null;
  categoria: string | null;
}

export interface DadosItemEstoqueParseados {
  idTiny: string;
  sku: string;
  nomeCompleto: string;
  codigoFabricante: string | null;
  codigoProdutoFornecedor: string | null;
  numeracaoBr: number | null;
  numeracaoEu: number | null;
  numeracaoUs: number | null;
  sistemaNumeracao: "br" | "eu" | "us" | "outro";
  valorPagoOriginal: number | null;
  dataCadastroTiny: string | null;
  observacoes: string | null;
  dadosTiny: Record<string, unknown>;
}

export interface ProdutoTinyParseado {
  modelo: DadosModeloParseados;
  item: DadosItemEstoqueParseados;
  fornecedor: DadosFornecedorParseados | null;
  localEstoque: DadosLocalEstoqueParseado | null;
  imagens: ImagemParseada[];
}

function inferirSistemaNumeracao(
  br: number | null,
  eu: number | null,
  us: number | null,
): "br" | "eu" | "us" | "outro" {
  if (br !== null) return "br";
  if (eu !== null) return "eu";
  if (us !== null) return "us";
  return "outro";
}

function inferirTipoRegiao(localizacao: string): "brasil" | "europa" | "outros" {
  const n = localizacao.toLowerCase();
  if (/\b(br|brasil|bra|sp|rj|mg|rs|pr|sc|df)\b/.test(n)) return "brasil";
  if (/\b(eu|europa|pt|portugal|es|espanha|fr|franca|it|italia|de|alemanha)\b/.test(n)) {
    return "europa";
  }
  return "outros";
}

function parseFornecedor(produto: TinyProdutoDetalhe): DadosFornecedorParseados | null {
  const idTiny = normalizarTexto(produto.id_fornecedor as string | undefined);
  const nome = normalizarTexto(produto.nome_fornecedor as string | undefined);
  const codigoFornecedor = normalizarTexto(produto.codigo_fornecedor as string | undefined);
  const codigoPeloFornecedor = normalizarTexto(
    produto.codigo_pelo_fornecedor as string | undefined,
  );

  if (!idTiny && !nome && !codigoFornecedor) return null;

  return {
    idTiny,
    nome,
    codigoFornecedor,
    codigoPeloFornecedor,
  };
}

function parseLocalEstoque(produto: TinyProdutoDetalhe): DadosLocalEstoqueParseado | null {
  const bruto = normalizarTexto(produto.localizacao);
  if (!bruto) return null;
  return {
    codigo: gerarSlug(bruto).slice(0, 60) || "sem-codigo",
    nome: bruto,
    tipoRegiao: inferirTipoRegiao(bruto),
  };
}

function ehUrlValida(valor: string | null): boolean {
  if (!valor) return false;
  return /^https?:\/\//i.test(valor.trim());
}

function extrairUrlDeNo(valor: unknown): string | null {
  if (!valor) return null;
  if (typeof valor === "string") {
    return ehUrlValida(valor) ? valor.trim() : null;
  }
  if (typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    const candidatos = [
      obj.anexo,
      obj.url,
      obj.link,
      obj.imagem,
      obj.imagem_externa,
      obj.url_imagem,
      obj.nome,
    ];
    for (const c of candidatos) {
      const url = extrairUrlDeNo(c);
      if (url) return url;
    }
  }
  return null;
}

function coletarDeArrayOuObjeto(valor: unknown, destino: string[]): void {
  if (!valor) return;
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const url = extrairUrlDeNo(item);
      if (url) destino.push(url);
    }
    return;
  }
  if (typeof valor === "object") {
    const url = extrairUrlDeNo(valor);
    if (url) destino.push(url);
  }
  if (typeof valor === "string" && ehUrlValida(valor)) {
    destino.push(valor.trim());
  }
}

function parseImagens(produto: TinyProdutoDetalhe): ImagemParseada[] {
  const urls: string[] = [];

  const camposCandidatos: Array<keyof TinyProdutoDetalhe | string> = [
    "anexos",
    "imagens_externas",
    "imagens",
  ];

  for (const campo of camposCandidatos) {
    const valor = (produto as unknown as Record<string, unknown>)[campo as string];
    coletarDeArrayOuObjeto(valor, urls);
  }

  const unicas = Array.from(new Set(urls.map((u) => u.trim())));
  return unicas.map((url) => ({ url, hash: null }));
}

function parseModelo(
  produto: TinyProdutoDetalhe,
  nomeModeloLimpo: string,
): DadosModeloParseados {
  const marca = normalizarTexto(produto.marca as string | undefined);
  const categoria = normalizarTexto(produto.categoria as string | undefined);
  const codigoFabricante = normalizarTexto(produto.codigo_pelo_fornecedor as string | undefined);
  const descricao = normalizarTexto(produto.descricao_complementar as string | undefined);

  const idTinyPaiBruto = normalizarTexto(
    (produto.idProdutoPai ?? produto.id_produto_pai) as string | undefined,
  );
  const idTinyPai =
    idTinyPaiBruto && !/^0+$/.test(idTinyPaiBruto) ? idTinyPaiBruto : null;

  const semente = [marca, nomeModeloLimpo].filter(Boolean).join(" ");
  const slug = gerarSlug(semente || nomeModeloLimpo) || gerarSlug(produto.id);

  return {
    nomeModelo: nomeModeloLimpo,
    slug,
    idTinyPai,
    codigoFabricante,
    descricao,
    marca,
    categoria,
  };
}

export function parseProdutoTiny(produto: TinyProdutoDetalhe): ProdutoTinyParseado {
  const { br, eu, us, nomeModelo, nomeCompleto } = parseNomeProdutoTiny(produto.nome);

  const sku = normalizarTexto(produto.codigo) ?? `tiny-${produto.id}`;
  const idTiny = String(produto.id);

  const fornecedor = parseFornecedor(produto);
  const localEstoque = parseLocalEstoque(produto);
  const imagens = parseImagens(produto);
  const modelo = parseModelo(produto, nomeModelo || nomeCompleto);

  const item: DadosItemEstoqueParseados = {
    idTiny,
    sku,
    nomeCompleto,
    codigoFabricante: modelo.codigoFabricante,
    codigoProdutoFornecedor: normalizarTexto(produto.codigo_pelo_fornecedor as string | undefined),
    numeracaoBr: br,
    numeracaoEu: eu,
    numeracaoUs: us,
    sistemaNumeracao: inferirSistemaNumeracao(br, eu, us),
    valorPagoOriginal: paraNumeroOuNulo(produto.preco_custo ?? produto.preco_custo_medio),
    dataCadastroTiny: paraDataIso(produto.data_criacao),
    observacoes: normalizarTexto(produto.obs as string | undefined),
    dadosTiny: produto as unknown as Record<string, unknown>,
  };

  return { modelo, item, fornecedor, localEstoque, imagens };
}

export function parseDataCompraDoTiny(produto: TinyProdutoDetalhe): string | null {
  return paraDataApenas(produto.data_criacao);
}
