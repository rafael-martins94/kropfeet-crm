import { useRef, useState, type InputHTMLAttributes } from "react";
import { FormInput } from "./FormField";
import { buscarEnderecoPorCep, formatarCep, normalizarCep, type ViaCepEndereco } from "../services/viacep";

interface CepInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onEnderecoEncontrado?: (endereco: ViaCepEndereco) => void;
  wrapperClassName?: string;
  hint?: string;
  error?: string;
}

export function CepInput({
  label = "CEP",
  value,
  onChange,
  onEnderecoEncontrado,
  wrapperClassName,
  hint,
  error,
  ...rest
}: CepInputProps) {
  const [buscando, setBuscando] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const ultimoCepBuscado = useRef("");

  const consultar = async (cepAtual: string) => {
    const digitos = normalizarCep(cepAtual);
    if (digitos.length !== 8 || digitos === ultimoCepBuscado.current) return;

    setBuscando(true);
    setErroCep(null);
    try {
      const endereco = await buscarEnderecoPorCep(digitos);
      if (!endereco) {
        setErroCep("CEP não encontrado.");
        return;
      }
      ultimoCepBuscado.current = digitos;
      onChange(endereco.cep);
      onEnderecoEncontrado?.(endereco);
    } catch {
      setErroCep("Falha ao consultar o CEP.");
    } finally {
      setBuscando(false);
    }
  };

  return (
    <FormInput
      {...rest}
      label={label}
      value={value}
      inputMode="numeric"
      placeholder="00000-000"
      maxLength={9}
      hint={hint ?? "Digite o CEP para preencher o endereço automaticamente."}
      error={error ?? erroCep ?? undefined}
      wrapperClassName={wrapperClassName}
      onChange={(e) => {
        const formatado = formatarCep(e.target.value);
        onChange(formatado);
        if (erroCep) setErroCep(null);
        if (normalizarCep(formatado).length < 8) {
          ultimoCepBuscado.current = "";
        }
      }}
      onBlur={() => consultar(value)}
      className={buscando ? "opacity-70" : undefined}
    />
  );
}
