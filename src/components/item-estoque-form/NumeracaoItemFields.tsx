import { FormInput, FieldWrapper } from "../FormField";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { cn } from "../../utils/cn";
import type { SistemaNumeracao, StatusItem } from "../../types/entities";
import type { UsSizeVariant } from "../../utils/sizeConversion";

const NUMERACAO_INPUT_WIDTH = "w-[4.75rem]";

type NumeracaoItemFieldsProps = {
  numeracaoBr: string;
  numeracaoEu: string;
  numeracaoUs: string;
  usVariant: UsSizeVariant | "";
  sistemaNumeracao: SistemaNumeracao;
  onBrChange: (value: string) => void;
  onEuChange: (value: string) => void;
  onUsChange?: (value: string) => void;
  onUsVariantChange: (variant: UsSizeVariant) => void;
  onSistemaChange?: (value: SistemaNumeracao) => void;
  /** @deprecated Inferido automaticamente no save; mantido só para compatibilidade. */
  showSistema?: boolean;
  /** US preenchido automaticamente ao selecionar o tipo (campo somente leitura). */
  usPreenchidoPorTipo?: boolean;
  showStatus?: boolean;
  statusItem?: StatusItem;
  onStatusChange?: (value: StatusItem) => void;
};

const US_VARIANT_OPCOES = [
  { value: "mens", label: "M" },
  { value: "y", label: "Y" },
  { value: "w", label: "W" },
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
  usPreenchidoPorTipo = false,
  showStatus = true,
  showSistema = false,
}: NumeracaoItemFieldsProps) {
  return (
    <div className="flex flex-nowrap items-end gap-x-4 overflow-x-auto pb-0.5">
      <FormInput
        label="BR"
        value={numeracaoBr}
        onChange={(e) => onBrChange(e.target.value)}
        inputMode="decimal"
        wrapperClassName={cn(NUMERACAO_INPUT_WIDTH, "shrink-0")}
      />
      <FormInput
        label="EU"
        value={numeracaoEu}
        onChange={(e) => onEuChange(e.target.value)}
        inputMode="decimal"
        wrapperClassName={cn(NUMERACAO_INPUT_WIDTH, "shrink-0")}
      />
      <FieldWrapper id="numeracao-us" label="US" className="shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            id="numeracao-us"
            value={numeracaoUs}
            onChange={onUsChange ? (e) => onUsChange(e.target.value) : undefined}
            readOnly={usPreenchidoPorTipo}
            inputMode="decimal"
            placeholder={usPreenchidoPorTipo ? "—" : "10"}
            className={cn(
              "input-base",
              NUMERACAO_INPUT_WIDTH,
              usPreenchidoPorTipo && "bg-surface-muted/60",
            )}
          />
          <SearchableSelectDropdown
            value={usVariant || ""}
            onChange={(v) => onUsVariantChange(v as UsSizeVariant)}
            options={[...US_VARIANT_OPCOES]}
            emptyLabel="Tipo"
            searchPlaceholder="Tipo…"
            triggerClassName="w-[7rem] shrink-0 px-2"
            className="w-[7rem] shrink-0"
          />
        </div>
      </FieldWrapper>
      {showSistema && onSistemaChange ? (
        <SearchableSelectDropdown
          label="Sistema de numeração"
          value={sistemaNumeracao}
          onChange={(v) => onSistemaChange(v as SistemaNumeracao)}
          options={[...SISTEMA_OPCOES]}
          emptyLabel="— Selecione —"
          searchPlaceholder="Buscar sistema…"
          className="ml-4 w-[9.5rem] shrink-0 sm:ml-8"
        />
      ) : null}
      {showStatus && statusItem !== undefined && onStatusChange ? (
        <SearchableSelectDropdown
          label="Status"
          value={statusItem}
          onChange={(v) => onStatusChange(v as StatusItem)}
          options={STATUS_OPCOES}
          emptyLabel="— Selecione —"
          searchPlaceholder="Buscar status…"
          className="w-[10rem] shrink-0"
        />
      ) : null}
    </div>
  );
}
