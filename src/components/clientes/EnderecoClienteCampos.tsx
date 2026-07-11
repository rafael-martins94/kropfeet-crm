import { useRef } from "react";
import { CepInput } from "../CepInput";
import { FieldWrapper, FormInput } from "../FormField";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import type { EnderecoClienteForm } from "../../services/enderecos-cliente";
import { opcoesComValorAtual, ufOpcoes } from "../../pages/clientes/clienteOpcoes";

interface EnderecoClienteCamposProps {
  value: EnderecoClienteForm;
  onChange: (patch: Partial<EnderecoClienteForm>) => void;
  idPrefix?: string;
  mostrarRotulo?: boolean;
}

export function EnderecoClienteCampos({
  value,
  onChange,
  idPrefix = "endereco",
  mostrarRotulo = false,
}: EnderecoClienteCamposProps) {
  const numeroRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
      {mostrarRotulo ? (
        <FormInput
          label="Nome do endereço"
          value={value.rotulo}
          onChange={(e) => onChange({ rotulo: e.target.value })}
          placeholder="Ex.: Casa, Trabalho, Entrega"
          wrapperClassName="sm:col-span-6"
        />
      ) : null}

      <CepInput
        value={value.cep}
        onChange={(v) => onChange({ cep: v })}
        wrapperClassName="sm:col-span-2"
        onEnderecoEncontrado={(e) => {
          onChange({
            cep: e.cep,
            endereco: e.logradouro || value.endereco,
            bairro: e.bairro || value.bairro,
            cidade: e.cidade || value.cidade,
            uf: e.uf || value.uf,
            complemento: value.complemento || e.complemento,
            pais: value.pais || "Brasil",
          });
          queueMicrotask(() => numeroRef.current?.focus());
        }}
      />
      <FormInput
        label="Logradouro"
        value={value.endereco}
        onChange={(e) => onChange({ endereco: e.target.value })}
        wrapperClassName="sm:col-span-4"
      />
      <FormInput
        ref={numeroRef}
        label="Número"
        value={value.numero}
        onChange={(e) => onChange({ numero: e.target.value })}
        wrapperClassName="sm:col-span-2"
      />
      <FormInput
        label="Complemento"
        value={value.complemento}
        onChange={(e) => onChange({ complemento: e.target.value })}
        wrapperClassName="sm:col-span-2"
      />
      <FormInput
        label="Bairro"
        value={value.bairro}
        onChange={(e) => onChange({ bairro: e.target.value })}
        wrapperClassName="sm:col-span-2"
      />
      <FormInput
        label="Cidade"
        value={value.cidade}
        onChange={(e) => onChange({ cidade: e.target.value })}
        wrapperClassName="sm:col-span-3"
      />
      <FieldWrapper id={`${idPrefix}-uf`} label="UF" className="sm:col-span-3">
        <SearchableSelectDropdown
          value={value.uf}
          options={opcoesComValorAtual(ufOpcoes, value.uf, "— Não informado —")}
          searchPlaceholder="Buscar UF…"
          emptyLabel="— Não informado —"
          onChange={(v) => onChange({ uf: v })}
        />
      </FieldWrapper>
      <FormInput
        label="País"
        value={value.pais}
        onChange={(e) => onChange({ pais: e.target.value })}
        wrapperClassName="sm:col-span-6"
      />
    </div>
  );
}
