import { useRef } from "react";
import { CepInput } from "../CepInput";
import { FieldWrapper, FormInput } from "../FormField";
import { SecondaryButton } from "../PrimaryButton";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { IconPlus, IconTrash } from "../Icons";
import type { EnderecoClienteForm } from "../../services/enderecos-cliente";
import { opcoesComValorAtual, ufOpcoes } from "../../pages/clientes/clienteOpcoes";

export function enderecoVazio(principal = false): EnderecoClienteForm {
  return {
    rotulo: principal ? "Principal" : "",
    principal,
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    pais: "Brasil",
  };
}

export function enderecoDeRegistro(e: {
  id: string;
  rotulo: string | null;
  principal: boolean;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
}): EnderecoClienteForm {
  return {
    id: e.id,
    rotulo: e.rotulo ?? "",
    principal: e.principal,
    cep: e.cep ?? "",
    endereco: e.endereco ?? "",
    numero: e.numero ?? "",
    complemento: e.complemento ?? "",
    bairro: e.bairro ?? "",
    cidade: e.cidade ?? "",
    uf: e.uf ?? "",
    pais: e.pais ?? "Brasil",
  };
}

interface EnderecosClienteEditorProps {
  enderecos: EnderecoClienteForm[];
  onChange: (enderecos: EnderecoClienteForm[]) => void;
}

export function EnderecosClienteEditor({ enderecos, onChange }: EnderecosClienteEditorProps) {
  const numeroRefs = useRef<Map<number, HTMLInputElement | null>>(new Map());

  const atualizar = (index: number, patch: Partial<EnderecoClienteForm>) => {
    onChange(
      enderecos.map((e, i) => {
        if (i !== index) {
          if (patch.principal) return { ...e, principal: false };
          return e;
        }
        const next = { ...e, ...patch };
        if (patch.principal && !next.rotulo.trim()) {
          next.rotulo = "Principal";
        }
        return next;
      }),
    );
  };

  const remover = (index: number) => {
    const next = enderecos.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((e) => e.principal)) {
      next[0] = { ...next[0], principal: true };
    }
    onChange(next);
  };

  const adicionar = () => {
    onChange([...enderecos, enderecoVazio()]);
  };

  if (enderecos.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">Nenhum endereço cadastrado.</p>
        <SecondaryButton type="button" icon={<IconPlus width={16} height={16} />} onClick={adicionar}>
          Adicionar endereço
        </SecondaryButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {enderecos.map((endereco, index) => (
        <div key={endereco.id ?? `novo-${index}`} className="rounded-xl border border-line bg-surface-subtle/40 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-ink">
                Endereço {index + 1}
              </span>
              <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="radio"
                  name="endereco-principal"
                  checked={endereco.principal}
                  onChange={() => atualizar(index, { principal: true })}
                  className="text-brand-600"
                />
                Principal
              </label>
            </div>
            {enderecos.length > 1 ? (
              <button
                type="button"
                className="btn-ghost h-8 w-8 p-0 text-ink-soft hover:text-red-600"
                onClick={() => remover(index)}
                aria-label="Remover endereço"
              >
                <IconTrash width={16} height={16} />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <FormInput
              label="Nome do endereço"
              value={endereco.rotulo}
              onChange={(e) => atualizar(index, { rotulo: e.target.value })}
              placeholder="Ex.: Casa, Trabalho, Entrega"
              wrapperClassName="sm:col-span-6"
            />

            <CepInput
              value={endereco.cep}
              onChange={(v) => atualizar(index, { cep: v })}
              wrapperClassName="sm:col-span-2"
              onEnderecoEncontrado={(e) => {
                atualizar(index, {
                  cep: e.cep,
                  endereco: e.logradouro || endereco.endereco,
                  bairro: e.bairro || endereco.bairro,
                  cidade: e.cidade || endereco.cidade,
                  uf: e.uf || endereco.uf,
                  complemento: endereco.complemento || e.complemento,
                  pais: endereco.pais || "Brasil",
                });
                queueMicrotask(() => numeroRefs.current.get(index)?.focus());
              }}
            />
            <FormInput
              label="Logradouro"
              value={endereco.endereco}
              onChange={(e) => atualizar(index, { endereco: e.target.value })}
              wrapperClassName="sm:col-span-4"
            />
            <FormInput
              ref={(el) => {
                numeroRefs.current.set(index, el);
              }}
              label="Número"
              value={endereco.numero}
              onChange={(e) => atualizar(index, { numero: e.target.value })}
              wrapperClassName="sm:col-span-2"
            />
            <FormInput
              label="Complemento"
              value={endereco.complemento}
              onChange={(e) => atualizar(index, { complemento: e.target.value })}
              wrapperClassName="sm:col-span-2"
            />
            <FormInput
              label="Bairro"
              value={endereco.bairro}
              onChange={(e) => atualizar(index, { bairro: e.target.value })}
              wrapperClassName="sm:col-span-2"
            />
            <FormInput
              label="Cidade"
              value={endereco.cidade}
              onChange={(e) => atualizar(index, { cidade: e.target.value })}
              wrapperClassName="sm:col-span-3"
            />
            <FieldWrapper id={`uf-endereco-${index}`} label="UF" className="sm:col-span-3">
              <SearchableSelectDropdown
                value={endereco.uf}
                options={opcoesComValorAtual(ufOpcoes, endereco.uf, "— Não informado —")}
                searchPlaceholder="Buscar UF…"
                emptyLabel="— Não informado —"
                onChange={(v) => atualizar(index, { uf: v })}
              />
            </FieldWrapper>
            <FormInput
              label="País"
              value={endereco.pais}
              onChange={(e) => atualizar(index, { pais: e.target.value })}
              wrapperClassName="sm:col-span-6"
            />
          </div>
        </div>
      ))}

      <SecondaryButton type="button" icon={<IconPlus width={16} height={16} />} onClick={adicionar}>
        Adicionar endereço
      </SecondaryButton>
    </div>
  );
}
