import { FormInput } from "../FormField";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { cn } from "../../utils/cn";
import type { SistemaNumeracao, StatusItem } from "../../types/entities";
import type { UsSizeVariant } from "../../utils/sizeConversion";

type NumeracaoItemFieldsProps = {
  numeracaoBr: string;
  numeracaoEu: string;
  numeracaoUs: string;
  usVariant: UsSizeVariant;
  sistemaNumeracao: SistemaNumeracao;
  onBrChange: (value: string) => void;
  onEuChange: (value: string) => void;
  onUsChange: (value: string) => void;
  onUsVariantChange: (variant: UsSizeVariant) => void;
  onSistemaChange: (value: SistemaNumeracao) => void;
  showStatus?: boolean;
  statusItem?: StatusItem;
  onStatusChange?: (value: StatusItem) => void;
};

const US_VARIANT_OPCOES = [
  { value: "mens", label: "M (masculino)" },
  { value: "y", label: "Y (infantil)" },
  { value: "w", label: "W (feminino)" },
] as const;

const SISTEMA_OPCOES = [
  { value: "br", label: "BR" },
  { value: "eu", label: "EU" },
  { value: "us", label: "US" },
  { value: "outro", label: "Outro" },
] as const;

const STATUS_OPCOES: Array<{ value: StatusItem; label: string }> = [
  { value: "em_estoque", label: "Em estoque" },
  { value: "fora_de_estoque", label: "Fora de estoque" },
  { value: "em_processo_de_compra", label: "Em processo de compra" },
  { value: "transferencia", label: "Transferência" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "devolvido", label: "Devolvido" },
  { value: "inativo", label: "Inativo" },
];

export function NumeracaoItemFields({
  numeracaoBr,
  numeracaoEu,
  numeracaoUs,
  usVariant,
  sistemaNumeracao,
  statusItem,
  onBrChange,
  onEuChange,
  onUsChange,
  onUsVariantChange,
  onSistemaChange,
  onStatusChange,
  showStatus = true,
}: NumeracaoItemFieldsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        showStatus ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-5",
      )}
    >
      <FormInput
        label="Numeração BR"
        value={numeracaoBr}
        onChange={(e) => onBrChange(e.target.value)}
        inputMode="decimal"
      />
      <FormInput
        label="Numeração EU"
        value={numeracaoEu}
        onChange={(e) => onEuChange(e.target.value)}
        inputMode="decimal"
      />
      <FormInput
        label="Numeração US"
        value={numeracaoUs}
        onChange={(e) => onUsChange(e.target.value)}
        inputMode="decimal"
        placeholder="Ex.: 10, 6,5"
      />
      <SearchableSelectDropdown
        label="Tipo US"
        value={usVariant}
        onChange={(v) => onUsVariantChange(v as UsSizeVariant)}
        options={[...US_VARIANT_OPCOES]}
        emptyLabel="— Selecione —"
        searchPlaceholder="Buscar tipo…"
      />
      <SearchableSelectDropdown
        label="Sistema de numeração"
        value={sistemaNumeracao}
        onChange={(v) => onSistemaChange(v as SistemaNumeracao)}
        options={[...SISTEMA_OPCOES]}
        emptyLabel="— Selecione —"
        searchPlaceholder="Buscar sistema…"
      />
      {showStatus && statusItem !== undefined && onStatusChange ? (
        <SearchableSelectDropdown
          label="Status"
          value={statusItem}
          onChange={(v) => onStatusChange(v as StatusItem)}
          options={STATUS_OPCOES}
          emptyLabel="— Selecione —"
          searchPlaceholder="Buscar status…"
        />
      ) : null}
    </div>
  );
}
