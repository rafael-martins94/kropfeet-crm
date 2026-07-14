import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { GhostButton, PrimaryButton } from "../PrimaryButton";
import { IconPrinter } from "../Icons";
import {
  ETIQUETA_ALTURA_MM,
  ETIQUETA_BARCODE_ALTURA_MM,
  ETIQUETA_GAP_MM,
  ETIQUETA_LARGURA_MM,
  ETIQUETA_PADDING_MM,
  calcularTamanhoFonteSkuPreview,
  gerarBarcodeSvg,
  imprimirEtiquetaItem,
} from "../../utils/etiquetaItem";

interface EtiquetaItemModalProps {
  open: boolean;
  onClose: () => void;
  sku: string;
}

export function EtiquetaItemModal({ open, onClose, sku }: EtiquetaItemModalProps) {
  const [barcodeSvg, setBarcodeSvg] = useState("");

  useEffect(() => {
    if (!open || !sku.trim()) {
      setBarcodeSvg("");
      return;
    }
    try {
      setBarcodeSvg(gerarBarcodeSvg(sku.trim()));
    } catch {
      setBarcodeSvg("");
    }
  }, [open, sku]);

  const previewWidth = 372;
  const previewHeight = Math.round(
    (previewWidth / ETIQUETA_LARGURA_MM) * ETIQUETA_ALTURA_MM,
  );
  const escala = previewWidth / ETIQUETA_LARGURA_MM;
  const paddingPx = Math.round(ETIQUETA_PADDING_MM * escala);
  const gapPx = Math.round(ETIQUETA_GAP_MM * escala);
  const fonteSkuPx = calcularTamanhoFonteSkuPreview(sku, previewHeight);
  const colunaLarguraPx = Math.round((previewWidth - paddingPx * 2 - gapPx) / 2);
  const barcodeAlturaPx = Math.round(ETIQUETA_BARCODE_ALTURA_MM * escala);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Imprimir etiqueta"
      description={`Brother QL-810W · ${ETIQUETA_LARGURA_MM} × ${ETIQUETA_ALTURA_MM} mm`}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton
            icon={<IconPrinter width={16} height={16} />}
            disabled={!sku.trim() || !barcodeSvg}
            onClick={() => imprimirEtiquetaItem(sku.trim())}
          >
            Imprimir
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-soft">
          SKU e código de barras em duas colunas, cada um centralizado na sua área. Na impressão, selecione a impressora Brother QL-810W
          e confirme o tamanho da etiqueta ({ETIQUETA_LARGURA_MM} × {ETIQUETA_ALTURA_MM} mm).
        </p>

        <div className="flex justify-center rounded-xl border border-line bg-surface-muted p-4">
          <div
            className="flex overflow-hidden rounded-xl border border-line bg-white text-black shadow-sm"
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
              padding: `${paddingPx}px`,
              gap: `${gapPx}px`,
            }}
          >
            <div
              className="flex min-w-0 flex-1 items-center justify-center"
              style={{ width: `${colunaLarguraPx}px` }}
            >
              <span
                className="text-center font-bold leading-tight"
                style={{
                  fontSize: `${fonteSkuPx}px`,
                  wordBreak: "break-all",
                }}
              >
                {sku.trim() || "—"}
              </span>
            </div>
            <div
              className="flex min-w-0 flex-1 items-center justify-center [&_svg]:block [&_svg]:h-auto [&_svg]:w-auto"
              style={{
                width: `${colunaLarguraPx}px`,
                height: `${previewHeight - paddingPx * 2}px`,
              }}
            >
              {barcodeSvg ? (
                <div
                  className="flex items-center justify-center [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:w-auto"
                  style={{ maxHeight: `${barcodeAlturaPx}px`, maxWidth: "100%" }}
                  dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
