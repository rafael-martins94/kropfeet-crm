import { useMemo } from "react";
import { FormInput } from "../FormField";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { ModeloImagensGaleria } from "./ModeloImagensGaleria";
import { useAsync } from "../../hooks/useAsync";
import { modelosProdutoService } from "../../services/modelos-produto";
import type { ModeloProduto } from "../../types/entities";

type IdentificacaoItemFieldsProps = {
  sku: React.ReactNode;
  nomeProduto: string;
  idModeloProduto: string;
  idFornecedor: string;
  idLocalEstoque: string;
  codigoFornecedor: string;
  modelos: ModeloProduto[];
  fornecedores: Array<{ id: string; nome: string }>;
  locais: Array<{ id: string; nome: string }>;
  loadingModelos?: boolean;
  loadingFornecedores?: boolean;
  loadingLocais?: boolean;
  onModeloChange: (id: string) => void;
  onFornecedorChange: (id: string) => void;
  onLocalChange: (id: string) => void;
  onCodigoFornecedorChange: (value: string) => void;
  showFornecedor?: boolean;
};

export function IdentificacaoItemFields({
  sku,
  nomeProduto,
  idModeloProduto,
  idFornecedor,
  idLocalEstoque,
  codigoFornecedor,
  modelos,
  fornecedores,
  locais,
  loadingModelos,
  loadingFornecedores,
  loadingLocais,
  onModeloChange,
  onFornecedorChange,
  onLocalChange,
  onCodigoFornecedorChange,
  showFornecedor = true,
}: IdentificacaoItemFieldsProps) {
  const thumbs = useAsync(() => modelosProdutoService.listarUrlsPrincipaisPorModelo(), []);
  const imagensModelo = useAsync(
    () =>
      idModeloProduto
        ? modelosProdutoService.obterImagens(idModeloProduto)
        : Promise.resolve([]),
    [idModeloProduto],
  );

  const modeloSelecionado = modelos.find((m) => m.id === idModeloProduto);

  const opcoesModelo = useMemo(
    () =>
      modelos.map((m) => ({
        value: m.id,
        label: m.nome_modelo,
        imageUrl: thumbs.data?.[m.id] ?? null,
      })),
    [modelos, thumbs.data],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_min(320px,36%)] lg:gap-10 lg:items-start">
      {/* Campos — coluna esquerda */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        <div className="flex flex-col gap-5 sm:col-span-2 sm:flex-row sm:items-end sm:gap-5">
          <div className="shrink-0">{sku}</div>
          <SearchableSelectDropdown
            label="Modelo de produto"
            value={idModeloProduto}
            onChange={onModeloChange}
            options={opcoesModelo}
            loading={loadingModelos || thumbs.loading}
            emptyLabel="— Selecione o modelo —"
            className="min-w-0 flex-1"
          />
        </div>

        {showFornecedor ? (
          <SearchableSelectDropdown
            label="Fornecedor"
            value={idFornecedor}
            onChange={onFornecedorChange}
            options={[
              { value: "", label: "— Nenhum —" },
              ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
            ]}
            loading={loadingFornecedores}
            emptyLabel="— Nenhum —"
          />
        ) : null}

        <SearchableSelectDropdown
          label="Local de estoque"
          value={idLocalEstoque}
          onChange={onLocalChange}
          options={[
            { value: "", label: "— Nenhum —" },
            ...locais.map((l) => ({ value: l.id, label: l.nome })),
          ]}
          loading={loadingLocais}
          emptyLabel="— Nenhum —"
          className={showFornecedor ? undefined : "sm:col-span-2"}
        />

        <FormInput
          label="Código do fornecedor"
          required
          value={codigoFornecedor}
          onChange={(e) => onCodigoFornecedorChange(e.target.value)}
          hint="Preenchido ao selecionar o modelo."
          className="font-numeric tabular-nums"
        />

        <div className="hidden sm:block" aria-hidden />

        <FormInput
          label="Nome produto"
          required
          readOnly
          value={nomeProduto}
          hint="Gerado a partir do modelo e numerações."
          wrapperClassName="sm:col-span-2 pt-1"
          className="bg-surface-muted/60"
        />
      </div>

      {/* Fotos — coluna direita, maior */}
      <aside className="lg:sticky lg:top-4">
        <ModeloImagensGaleria
          idModelo={idModeloProduto}
          imagens={imagensModelo.data ?? []}
          nomeModelo={modeloSelecionado?.nome_modelo}
          loading={Boolean(idModeloProduto && imagensModelo.loading)}
        />
      </aside>
    </div>
  );
}
