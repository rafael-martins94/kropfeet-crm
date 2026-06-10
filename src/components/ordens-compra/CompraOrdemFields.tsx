import { useEffect, useMemo, useState } from "react";
import { FormInput } from "../FormField";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { calcularValoresCompra, mensagemCotacaoIndisponivel } from "../../services/cambio-compra";
import { formatarMoeda } from "../../utils/format";

const MOEDAS = ["EUR", "BRL"];

type CompraOrdemFieldsProps = {
  dataCompra: string;
  moedaCompra: string;
  valorOriginal: string;
  valorReal: string;
  valorEuro: string;
  cambioReal: string;
  cambioEuro: string;
  onDataChange: (value: string) => void;
  onMoedaChange: (value: string) => void;
  onValorOriginalChange: (value: string) => void;
  onValoresCalculados: (valores: {
    valorReal: string;
    valorEuro: string;
    cambioReal: string;
    cambioEuro: string;
  }) => void;
};

function numOuNulo(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

export function CompraOrdemFields({
  dataCompra,
  moedaCompra,
  valorOriginal,
  valorReal,
  valorEuro,
  cambioReal,
  cambioEuro,
  onDataChange,
  onMoedaChange,
  onValorOriginalChange,
  onValoresCalculados,
}: CompraOrdemFieldsProps) {
  const [calculando, setCalculando] = useState(false);
  const [avisoCambio, setAvisoCambio] = useState<string | null>(null);

  const opcoesMoeda = useMemo(
    () => MOEDAS.map((m) => ({ value: m, label: m })),
    [],
  );

  useEffect(() => {
    const valor = numOuNulo(valorOriginal);
    if (!dataCompra || !moedaCompra || valor === null) {
      setAvisoCambio(null);
      return;
    }

    let cancelado = false;
    setCalculando(true);

    calcularValoresCompra(moedaCompra, valor, dataCompra)
      .then((r) => {
        if (cancelado) return;

        if (!r.cotacaoReal || !r.cotacaoEuro) {
          setAvisoCambio(mensagemCotacaoIndisponivel(dataCompra));
        } else {
          setAvisoCambio(null);
        }

        onValoresCalculados({
          valorReal: r.valorReal?.toString() ?? "",
          valorEuro: r.valorEuro?.toString() ?? "",
          cambioReal: r.cambioParaReal?.toString() ?? "",
          cambioEuro: r.cambioParaEuro?.toString() ?? "",
        });
      })
      .catch(() => {
        if (!cancelado) setAvisoCambio(mensagemCotacaoIndisponivel(dataCompra));
      })
      .finally(() => {
        if (!cancelado) setCalculando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [dataCompra, moedaCompra, valorOriginal, onValoresCalculados]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormInput
          label="Data da compra"
          type="date"
          required
          value={dataCompra}
          onChange={(e) => onDataChange(e.target.value)}
        />
        <SearchableSelectDropdown
          label="Moeda"
          value={moedaCompra}
          onChange={onMoedaChange}
          options={opcoesMoeda}
          emptyLabel="— Selecione —"
          searchPlaceholder="Buscar moeda…"
        />
        <FormInput
          label="Valor pago (moeda original)"
          required
          value={valorOriginal}
          onChange={(e) => onValorOriginalChange(e.target.value)}
          inputMode="decimal"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormInput
          label="Câmbio → BRL"
          readOnly
          value={calculando ? "Calculando…" : cambioReal}
          className="bg-surface-muted/60"
        />
        <FormInput
          label="Valor pago (BRL)"
          readOnly
          value={calculando ? "Calculando…" : valorReal}
          className="bg-surface-muted/60"
        />
        <FormInput
          label="Câmbio → EUR"
          readOnly
          value={calculando ? "Calculando…" : cambioEuro}
          className="bg-surface-muted/60"
        />
        <FormInput
          label="Valor pago (EUR)"
          readOnly
          value={calculando ? "Calculando…" : valorEuro}
          className="bg-surface-muted/60"
        />
      </div>

      {avisoCambio ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {avisoCambio}
        </p>
      ) : null}

      {valorReal && moedaCompra ? (
        <p className="text-xs text-ink-soft">
          Resumo: {formatarMoeda(numOuNulo(valorOriginal) ?? 0, moedaCompra)} →{" "}
          {formatarMoeda(numOuNulo(valorReal) ?? 0, "BRL")} /{" "}
          {formatarMoeda(numOuNulo(valorEuro) ?? 0, "EUR")}
        </p>
      ) : null}
    </div>
  );
}
