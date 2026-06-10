import { useState } from "react";
import { FormInput } from "../FormField";
import { SecondaryButton } from "../PrimaryButton";
import { itensEstoqueService } from "../../services/itens-estoque";

type SkuComGeradorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function SkuComGerador({ value, onChange, disabled, required }: SkuComGeradorProps) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleGerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const sku = await itensEstoqueService.proximoSkuDisponivel();
      onChange(sku);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar SKU.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="inline-flex max-w-full flex-col gap-1">
      <div className="flex items-end gap-2">
        <FormInput
          label="SKU"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          wrapperClassName="w-[7.5rem] sm:w-32"
          className="font-numeric tabular-nums"
        />
        <SecondaryButton
          type="button"
          onClick={handleGerar}
          disabled={disabled || gerando}
          className="mb-0.5 h-[38px] shrink-0 whitespace-nowrap px-3"
        >
          {gerando ? "…" : "Gerar"}
        </SecondaryButton>
      </div>
      {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
    </div>
  );
}
