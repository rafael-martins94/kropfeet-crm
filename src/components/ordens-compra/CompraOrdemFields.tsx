import { useMemo } from "react";
import { FormInput } from "../FormField";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";

const MOEDAS = ["EUR", "BRL"];

type CompraOrdemFieldsProps = {
  dataCompra: string;
  moedaCompra: string;
  valorCusto: string;
  idFornecedor: string;
  fornecedores: Array<{ id: string; nome: string }>;
  loadingFornecedores?: boolean;
  onDataChange: (value: string) => void;
  onMoedaChange: (value: string) => void;
  onValorCustoChange: (value: string) => void;
  onFornecedorChange: (value: string) => void;
};

export function CompraOrdemFields({
  dataCompra,
  moedaCompra,
  valorCusto,
  idFornecedor,
  fornecedores,
  loadingFornecedores,
  onDataChange,
  onMoedaChange,
  onValorCustoChange,
  onFornecedorChange,
}: CompraOrdemFieldsProps) {
  const opcoesMoeda = useMemo(
    () => MOEDAS.map((m) => ({ value: m, label: m })),
    [],
  );

  const opcoesFornecedor = useMemo(
    () => fornecedores.map((f) => ({ value: f.id, label: f.nome })),
    [fornecedores],
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SearchableSelectDropdown
        label="Fornecedor"
        value={idFornecedor}
        onChange={onFornecedorChange}
        options={opcoesFornecedor}
        loading={loadingFornecedores}
        emptyLabel="— Selecione o fornecedor —"
        searchPlaceholder="Buscar fornecedor…"
        className="sm:col-span-2"
      />
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
        label="Valor custo"
        required
        value={valorCusto}
        onChange={(e) => onValorCustoChange(e.target.value)}
        inputMode="decimal"
        wrapperClassName="sm:col-span-2"
      />
    </div>
  );
}
