import { useMemo, useState } from "react";
import { FormInput } from "../FormField";
import { SearchableSelectDropdown } from "../SearchableSelectDropdown";
import { ModeloImagensGaleria } from "./ModeloImagensGaleria";
import { ModeloProdutoSelect } from "../modelos-produto/ModeloProdutoSelect";
import { ModeloRapidoModal } from "../modelos-produto/ModeloRapidoModal";
import { IconEdit } from "../Icons";
import { useAsync } from "../../hooks/useAsync";
import { categoriasService } from "../../services/categorias";
import { modelosProdutoService } from "../../services/modelos-produto";
import type { ModeloProduto } from "../../types/entities";
import { cn } from "../../utils/cn";

type IdentificacaoItemFieldsProps = {
  sku: React.ReactNode;
  nomeProduto: string;
  idModeloProduto: string;
  idFornecedor: string;
  idLocalEstoque: string;
  codigoFornecedor: string;
  /** @deprecated Busca remota substitui a lista local. Mantido por compatibilidade. */
  modelos?: ModeloProduto[];
  /** Modelo já carregado pelo pai (evita busca duplicada na edição). */
  modeloVinculado?: ModeloProduto | null;
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
  showEditarModelo?: boolean;
  /** Permite cadastrar modelo na hora (modal rápido). */
  permitirNovoModelo?: boolean;
  /** Layout otimizado para a tela de edição de item. */
  layoutEdicao?: boolean;
};

export function IdentificacaoItemFields({
  sku,
  nomeProduto,
  idModeloProduto,
  idFornecedor,
  idLocalEstoque,
  codigoFornecedor,
  modeloVinculado,
  fornecedores,
  locais,
  loadingFornecedores,
  loadingLocais,
  onModeloChange,
  onFornecedorChange,
  onLocalChange,
  onCodigoFornecedorChange,
  showFornecedor = true,
  showEditarModelo = true,
  permitirNovoModelo = false,
  layoutEdicao = false,
}: IdentificacaoItemFieldsProps) {
  const [modalNovoModelo, setModalNovoModelo] = useState(false);
  const categorias = useAsync(() => categoriasService.listarTodas(), []);
  const modeloRemoto = useAsync(
    () => {
      if (modeloVinculado) return Promise.resolve(modeloVinculado);
      if (!idModeloProduto) return Promise.resolve(null);
      return modelosProdutoService.obter(idModeloProduto);
    },
    [idModeloProduto, modeloVinculado],
  );

  const modeloSelecionado = modeloVinculado ?? modeloRemoto.data;
  const nomeCategoria =
    categorias.data?.find((c) => c.id === modeloSelecionado?.id_categoria)?.nome ?? "";

  const imagensModelo = useAsync(
    () =>
      idModeloProduto
        ? modelosProdutoService.obterImagens(idModeloProduto)
        : Promise.resolve([]),
    [idModeloProduto],
  );

  const modeloOpcao = useMemo(
    () =>
      modeloSelecionado
        ? { id: modeloSelecionado.id, nome_modelo: modeloSelecionado.nome_modelo }
        : null,
    [modeloSelecionado],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_min(320px,36%)] lg:gap-10 lg:items-start">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        {layoutEdicao && nomeProduto ? (
          <div className="sm:col-span-2 rounded-xl border border-line bg-surface-subtle/50 px-4 py-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
              Nome do produto
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-ink">{nomeProduto}</p>
            <p className="mt-1 text-xs text-ink-soft">
              Atualizado automaticamente a partir do modelo e das numerações.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-5 sm:col-span-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="shrink-0">{sku}</div>
          <div className="flex min-w-0 flex-1 items-end gap-2">
            <ModeloProdutoSelect
              value={idModeloProduto}
              onChange={(id) => onModeloChange(id)}
              modeloSelecionado={modeloOpcao}
              className="min-w-0 flex-1"
              onNovoModelo={permitirNovoModelo ? () => setModalNovoModelo(true) : undefined}
            />
            {showEditarModelo && idModeloProduto ? (
              <a
                href={`/modelos-produto/${idModeloProduto}/editar`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "btn-secondary mb-0 inline-flex h-[38px] shrink-0 items-center gap-1.5 px-3",
                )}
                title="Editar modelo em nova aba"
              >
                <IconEdit width={16} height={16} />
                <span className="hidden sm:inline">Editar</span>
              </a>
            ) : null}
          </div>
        </div>

        {layoutEdicao ? (
          <FormInput
            label="Categoria (modelo)"
            readOnly
            value={nomeCategoria || "—"}
            hint="Definida no modelo vinculado."
            className="bg-surface-muted/60"
          />
        ) : null}

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
        />

        <FormInput
          label="Código do fornecedor"
          required
          value={codigoFornecedor}
          onChange={(e) => onCodigoFornecedorChange(e.target.value)}
          hint="Salvo no modelo de produto (referência no catálogo do fornecedor)."
          className="font-numeric tabular-nums"
        />

        {!layoutEdicao ? (
          <FormInput
            label="Nome produto"
            required
            readOnly
            value={nomeProduto}
            hint="Gerado a partir do modelo e numerações."
            wrapperClassName="sm:col-span-2 pt-1"
            className="bg-surface-muted/60"
          />
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-4">
        <ModeloImagensGaleria
          idModelo={idModeloProduto}
          imagens={imagensModelo.data ?? []}
          nomeModelo={modeloSelecionado?.nome_modelo}
          loading={Boolean(idModeloProduto && imagensModelo.loading)}
          aspectRatio={layoutEdicao ? "16/9" : "4/5"}
        />
      </aside>

      {permitirNovoModelo ? (
        <ModeloRapidoModal
          open={modalNovoModelo}
          onClose={() => setModalNovoModelo(false)}
          onCriado={(modelo) => onModeloChange(modelo.id)}
        />
      ) : null}
    </div>
  );
}
