import { useState } from "react";
import { FormInput } from "../FormField";
import { SecondaryButton } from "../PrimaryButton";
import { itensEstoqueService } from "../../services/itens-estoque";

type SkuComGeradorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Ignora o item atual ao editar (permite manter o mesmo SKU). */
  ignorarId?: string;
  disabled?: boolean;
  required?: boolean;
};

export function SkuComGerador({
  value,
  onChange,
  ignorarId,
  disabled,
  required,
}: SkuComGeradorProps) {
  const [gerando, setGerando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [erroSku, setErroSku] = useState<string | null>(null);

  const handleChange = (novo: string) => {
    setErroSku(null);
    onChange(novo);
  };

  const handleBlur = async () => {
    const sku = value.trim();
    if (!sku) {
      if (required) setErroSku("Informe o SKU.");
      return;
    }

    setVerificando(true);
    setErroSku(null);
    try {
      const existe = await itensEstoqueService.skuExiste(sku, ignorarId);
      if (existe) setErroSku(`SKU ${sku} em uso`);
    } catch (e) {
      setErroSku(e instanceof Error ? e.message : "Erro ao verificar SKU.");
    } finally {
      setVerificando(false);
    }
  };

  const handleGerar = async () => {
    setGerando(true);
    setErroGeracao(null);
    setErroSku(null);
    try {
      const sku = await itensEstoqueService.proximoSkuDisponivel();
      onChange(sku);
    } catch (e) {
      setErroGeracao(e instanceof Error ? e.message : "Erro ao gerar SKU.");
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
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => void handleBlur()}
          disabled={disabled || verificando}
          error={erroSku ?? undefined}
          hint={verificando ? "Verificando…" : undefined}
          wrapperClassName="w-[7.5rem] sm:w-32"
          className="font-numeric tabular-nums"
        />
        <SecondaryButton
          type="button"
          onClick={handleGerar}
          disabled={disabled || gerando || verificando}
          className="mb-0.5 h-[38px] shrink-0 whitespace-nowrap px-3"
        >
          {gerando ? "…" : "Gerar"}
        </SecondaryButton>
      </div>
      {erroGeracao ? <p className="text-xs text-red-600">{erroGeracao}</p> : null}
    </div>
  );
}
