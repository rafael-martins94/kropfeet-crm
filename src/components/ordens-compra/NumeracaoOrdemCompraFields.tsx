import type { ReactNode } from "react";
import { FormInput } from "../FormField";
import { cn } from "../../utils/cn";
import { formatNumeracaoUsDisplay, type UsSizeVariant } from "../../utils/sizeConversion";

const US_VARIANT_OPCOES: Array<{ value: UsSizeVariant; label: string; title: string }> = [
  { value: "mens", label: "M", title: "Masculino" },
  { value: "y", label: "Y", title: "Infantil (C/Y)" },
  { value: "w", label: "W", title: "Feminino" },
];

type NumeracaoOrdemCompraFieldsProps = {
  numeracaoBr: string;
  numeracaoEu: string;
  numeracaoUs: string;
  usVariant: UsSizeVariant | "";
  onBrChange: (value: string) => void;
  onEuChange: (value: string) => void;
  onUsVariantChange: (variant: UsSizeVariant) => void;
};

function CampoNumeracaoCard({
  titulo,
  subtitulo,
  children,
  className,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface-subtle/35 p-4",
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold text-ink">{titulo}</p>
        <p className="text-xs text-ink-soft">{subtitulo}</p>
      </div>
      {children}
    </div>
  );
}

export function NumeracaoOrdemCompraFields({
  numeracaoBr,
  numeracaoEu,
  numeracaoUs,
  usVariant,
  onBrChange,
  onEuChange,
  onUsVariantChange,
}: NumeracaoOrdemCompraFieldsProps) {
  const usDisplay = numeracaoUs ? formatNumeracaoUsDisplay(numeracaoUs, usVariant) : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Informe a numeração em <strong className="font-medium text-ink">BR</strong> ou{" "}
        <strong className="font-medium text-ink">EU</strong> — a outra é preenchida
        automaticamente. Escolha o tipo US para calcular a numeração americana.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CampoNumeracaoCard titulo="Brasil" subtitulo="Numeração BR">
          <FormInput
            label="Tamanho"
            value={numeracaoBr}
            onChange={(e) => onBrChange(e.target.value)}
            inputMode="decimal"
            placeholder="40,5"
            className="font-numeric tabular-nums text-center text-lg"
          />
        </CampoNumeracaoCard>

        <CampoNumeracaoCard titulo="Europa" subtitulo="Numeração EU">
          <FormInput
            label="Tamanho"
            value={numeracaoEu}
            onChange={(e) => onEuChange(e.target.value)}
            inputMode="decimal"
            placeholder="42,5"
            className="font-numeric tabular-nums text-center text-lg"
          />
        </CampoNumeracaoCard>

        <CampoNumeracaoCard titulo="Estados Unidos" subtitulo="Calculado a partir de BR/EU">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="label-base">Tipo</span>
              <div
                className="inline-flex w-full rounded-lg border border-line bg-surface p-0.5"
                role="group"
                aria-label="Tipo de numeração US"
              >
                {US_VARIANT_OPCOES.map((opcao) => {
                  const ativo = usVariant === opcao.value;
                  return (
                    <button
                      key={opcao.value}
                      type="button"
                      title={opcao.title}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                        ativo
                          ? "bg-brand-600 text-white shadow-sm"
                          : "text-ink-soft hover:bg-brand-50/80 hover:text-ink",
                      )}
                      onClick={() => onUsVariantChange(opcao.value)}
                    >
                      {opcao.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="label-base">Tamanho US</span>
              <div
                className={cn(
                  "flex min-h-[2.75rem] items-center justify-center rounded-lg border border-line px-3",
                  numeracaoUs ? "bg-surface" : "bg-surface-muted/60",
                )}
                aria-live="polite"
              >
                {numeracaoUs ? (
                  <span className="font-numeric text-lg font-semibold tabular-nums text-ink">
                    {usDisplay}
                  </span>
                ) : (
                  <span className="text-sm text-ink-faint">
                    {usVariant ? "Sem equivalência para este tamanho" : "Selecione o tipo US"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CampoNumeracaoCard>
      </div>
    </div>
  );
}
