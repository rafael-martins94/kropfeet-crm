import JsBarcode from "jsbarcode";

/** Área útil da etiqueta Brother QL-810W (62 × 29 mm). */
export const ETIQUETA_LARGURA_MM = 62;
export const ETIQUETA_ALTURA_MM = 29;
export const ETIQUETA_PADDING_MM = 1.5;
export const ETIQUETA_GAP_MM = 1;
export const ETIQUETA_BARCODE_ALTURA_MM = 17;
/** Teto da fonte do SKU (~28pt): SKUs de 3–4 dígitos saem neste tamanho. */
export const ETIQUETA_SKU_FONTE_MAX_MM = 10;

const estilosColunaEtiqueta = `
    .coluna {
      flex: 1 1 0;
      min-width: 0;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sku {
      font-weight: 700;
      line-height: 1;
      text-align: center;
      word-break: break-all;
      color: #000;
    }
    .barcode svg {
      display: block;
      width: auto;
      max-width: 100%;
      height: ${ETIQUETA_BARCODE_ALTURA_MM}mm;
      max-height: ${ETIQUETA_BARCODE_ALTURA_MM}mm;
    }`;

/** Maior fonte do SKU (em mm) que cabe na coluna esquerda; até 2 linhas se for longo. */
export function calcularTamanhoFonteSkuMm(sku: string): number {
  const texto = sku.trim();
  const n = Math.max(texto.length, 1);
  // Largura média do caractere em Arial bold: dígitos ~0,56em; letras chegam a ~0,72em.
  const larguraCaractere = /^[0-9]+$/.test(texto) ? 0.58 : 0.72;
  const larguraColuna =
    (ETIQUETA_LARGURA_MM - ETIQUETA_PADDING_MM * 2 - ETIQUETA_GAP_MM) / 2;
  const larguraUtil = larguraColuna * 0.92;
  const alturaUtil = ETIQUETA_ALTURA_MM - ETIQUETA_PADDING_MM * 2;

  let fonte = larguraUtil / (n * larguraCaractere);
  if (fonte < 4) {
    const porLinha = Math.ceil(n / 2);
    fonte = Math.min(larguraUtil / (porLinha * larguraCaractere), alturaUtil / (2 * 1.1));
  }
  return Math.round(Math.min(fonte, ETIQUETA_SKU_FONTE_MAX_MM) * 10) / 10;
}

export function gerarBarcodeSvg(sku: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, sku, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    height: 50,
    width: 1.3,
  });
  return new XMLSerializer().serializeToString(svg);
}

function montarHtmlEtiqueta(sku: string, barcodeSvg: string): string {
  const skuEscapado = sku
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const fonteSku = `${calcularTamanhoFonteSkuMm(sku)}mm`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${skuEscapado}</title>
  <style>
    @page {
      size: ${ETIQUETA_LARGURA_MM}mm ${ETIQUETA_ALTURA_MM}mm;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${ETIQUETA_LARGURA_MM}mm;
      height: ${ETIQUETA_ALTURA_MM}mm;
    }
    .etiqueta {
      display: flex;
      align-items: stretch;
      gap: ${ETIQUETA_GAP_MM}mm;
      width: ${ETIQUETA_LARGURA_MM}mm;
      height: ${ETIQUETA_ALTURA_MM}mm;
      padding: ${ETIQUETA_PADDING_MM}mm;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
    }
    ${estilosColunaEtiqueta}
    .sku {
      font-size: ${fonteSku};
    }
    @media print {
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="etiqueta">
    <div class="coluna">
      <div class="sku">${skuEscapado}</div>
    </div>
    <div class="coluna barcode">
      ${barcodeSvg}
    </div>
  </div>
</body>
</html>`;
}

export function imprimirEtiquetaItem(sku: string): void {
  const barcodeSvg = gerarBarcodeSvg(sku);
  const html = montarHtmlEtiqueta(sku, barcodeSvg);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Impressão de etiqueta");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const janela = iframe.contentWindow;
  const doc = janela?.document;
  if (!janela || !doc) {
    iframe.remove();
    return;
  }

  const limpar = () => {
    iframe.remove();
  };

  janela.addEventListener("afterprint", limpar, { once: true });

  doc.open();
  doc.write(html);
  doc.close();

  const imprimir = () => {
    janela.focus();
    janela.print();
  };

  if (doc.readyState === "complete") {
    imprimir();
  } else {
    iframe.addEventListener("load", imprimir, { once: true });
  }

  window.setTimeout(() => {
    if (iframe.isConnected) iframe.remove();
  }, 60_000);
}
