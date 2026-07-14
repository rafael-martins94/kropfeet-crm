import JsBarcode from "jsbarcode";

/** Área útil da etiqueta Brother QL-810W (62 × 29 mm). */
export const ETIQUETA_LARGURA_MM = 62;
export const ETIQUETA_ALTURA_MM = 29;
export const ETIQUETA_PADDING_MM = 1.5;
export const ETIQUETA_GAP_MM = 1;
export const ETIQUETA_BARCODE_ALTURA_MM = 17;

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
      line-height: 1.1;
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

export function calcularTamanhoFonteSku(sku: string): string {
  const n = sku.trim().length;
  if (n <= 4) return "11pt";
  if (n <= 7) return "9.5pt";
  if (n <= 10) return "8.5pt";
  if (n <= 14) return "8pt";
  return "7.5pt";
}

export function calcularTamanhoFonteSkuPreview(sku: string, alturaPx: number): number {
  const n = sku.trim().length;
  if (n <= 4) return Math.round(alturaPx * 0.26);
  if (n <= 7) return Math.round(alturaPx * 0.22);
  if (n <= 10) return Math.round(alturaPx * 0.19);
  if (n <= 14) return Math.round(alturaPx * 0.16);
  return Math.round(alturaPx * 0.14);
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
  const fonteSku = calcularTamanhoFonteSku(sku);

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
