import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormTextarea } from "../../components/FormField";
import { IdentificacaoItemFields } from "../../components/item-estoque-form/IdentificacaoItemFields";
import { SkuComGerador } from "../../components/item-estoque-form/SkuComGerador";
import { NumeracaoOrdemCompraFields } from "../../components/ordens-compra/NumeracaoOrdemCompraFields";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SearchableSelectDropdown } from "../../components/SearchableSelectDropdown";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { itensEstoqueService } from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { useAsync } from "../../hooks/useAsync";
import { useListReturnTo } from "../../hooks/useListDetailNavigation";
import { limparParaBanco } from "../../utils/format";
import {
  montarNomeProdutoComNumeracoes,
  normalizeNumeracaoUsInput,
  normalizeSizeValue,
  parseNumeracaoUs,
  aplicarEquivalenciaBrEuForm,
  inferirSistemaNumeracao,
  numeracaoUsAoMudarTipo,
  type UsSizeVariant,
} from "../../utils/sizeConversion";
import type { ItemEstoqueUpdate, ModeloProduto, StatusItem } from "../../types/entities";

type FormState = {
  sku: string;
  nome_produto: string;
  id_modelo_produto: string;
  id_local_estoque: string;
  codigo_fornecedor: string;
  numeracao_br: string;
  numeracao_eu: string;
  numeracao_us: string;
  us_variant: UsSizeVariant | "";
  status_item: StatusItem;
  observacoes: string;
};

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

const vazio: FormState = {
  sku: "",
  nome_produto: "",
  id_modelo_produto: "",
  id_local_estoque: "",
  codigo_fornecedor: "",
  numeracao_br: "",
  numeracao_eu: "",
  numeracao_us: "",
  us_variant: "mens",
  status_item: "em_estoque",
  observacoes: "",
};

function numOuNulo(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function preencherUsSeTipoSelecionado(
  numeracaoBr: string,
  numeracaoEu: string,
  usVariant: UsSizeVariant | "",
): string {
  if (!usVariant) return "";
  return numeracaoUsAoMudarTipo(numeracaoBr, numeracaoEu, "", usVariant, usVariant);
}

export default function ItemEstoqueFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const returnToLista = useListReturnTo("/itens-estoque");
  const detalheState = id ? { returnTo: returnToLista } : undefined;

  const [form, setForm] = useState<FormState>(vazio);
  const [modeloVinculado, setModeloVinculado] = useState<ModeloProduto | null>(null);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modelos = useAsync(
    () =>
      modelosProdutoService.listar({ page: 1, pageSize: 500, orderBy: "nome_modelo", ascending: true }),
    [],
  );
  const locais = useAsync(() => locaisEstoqueService.listarTodos(), []);

  useEffect(() => {
    if (!id) {
      navigate("/ordens-compra/novo", { replace: true });
      return;
    }

    setLoadingInicial(true);
    itensEstoqueService
      .obter(id)
      .then(async (it) => {
        if (!it) return;
        const modelo = await modelosProdutoService.obter(it.id_modelo_produto);
        setModeloVinculado(modelo);
        const usParsed = parseNumeracaoUs(it.numeracao_us);
        setForm({
          sku: it.sku,
          nome_produto: it.nome_produto,
          id_modelo_produto: it.id_modelo_produto,
          id_local_estoque: it.id_local_estoque ?? "",
          codigo_fornecedor:
            it.codigo_fornecedor?.trim() || modelo?.codigo_fabricante?.trim() || "",
          numeracao_br: it.numeracao_br?.toString() ?? "",
          numeracao_eu: it.numeracao_eu?.toString() ?? "",
          numeracao_us: usParsed ? String(usParsed.value).replace(".", ",") : "",
          us_variant: usParsed?.variant ?? "mens",
          status_item: it.status_item,
          observacoes: it.observacoes ?? "",
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id, navigate]);

  const modeloSelecionado =
    modeloVinculado ??
    (modelos.data?.data ?? []).find((m) => m.id === form.id_modelo_produto);

  useEffect(() => {
    if (!modeloSelecionado) return;
    const br = normalizeSizeValue(form.numeracao_br);
    const eu = normalizeSizeValue(form.numeracao_eu);
    const usNum = normalizeSizeValue(form.numeracao_us);
    const us =
      usNum !== null && form.us_variant
        ? { value: usNum, variant: form.us_variant }
        : null;
    const nome = montarNomeProdutoComNumeracoes(modeloSelecionado.nome_modelo, br, eu, us);
    setForm((s) => (s.nome_produto === nome ? s : { ...s, nome_produto: nome }));
  }, [
    modeloSelecionado,
    form.numeracao_br,
    form.numeracao_eu,
    form.numeracao_us,
    form.us_variant,
  ]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleModeloChange = (modeloId: string) => {
    if (!modeloId) {
      setModeloVinculado(null);
      setForm((s) => ({ ...s, id_modelo_produto: "" }));
      return;
    }

    const modeloLista = (modelos.data?.data ?? []).find((m) => m.id === modeloId);
    if (modeloLista) {
      setModeloVinculado(modeloLista);
      setForm((s) => ({
        ...s,
        id_modelo_produto: modeloId,
        codigo_fornecedor: modeloLista.codigo_fabricante ?? s.codigo_fornecedor,
      }));
      return;
    }

    setForm((s) => ({ ...s, id_modelo_produto: modeloId }));
    void modelosProdutoService.obter(modeloId).then((modelo) => {
      if (!modelo) return;
      setModeloVinculado(modelo);
      setForm((s) =>
        s.id_modelo_produto !== modeloId
          ? s
          : {
              ...s,
              codigo_fornecedor: modelo.codigo_fabricante ?? s.codigo_fornecedor,
            },
      );
    });
  };

  const handleBrChange = (value: string) => {
    setForm((s) => {
      const eq = aplicarEquivalenciaBrEuForm("br", value);
      if (!eq) {
        return {
          ...s,
          numeracao_br: value,
          numeracao_us: preencherUsSeTipoSelecionado(value, s.numeracao_eu, s.us_variant),
        };
      }
      const numeracaoEu = eq.numeracao_eu;
      return {
        ...s,
        ...eq,
        numeracao_br: value,
        numeracao_us: preencherUsSeTipoSelecionado(value, numeracaoEu, s.us_variant),
      };
    });
  };

  const handleEuChange = (value: string) => {
    setForm((s) => {
      const eq = aplicarEquivalenciaBrEuForm("eu", value);
      if (!eq) {
        return {
          ...s,
          numeracao_eu: value,
          numeracao_us: preencherUsSeTipoSelecionado(s.numeracao_br, value, s.us_variant),
        };
      }
      const numeracaoBr = eq.numeracao_br;
      return {
        ...s,
        ...eq,
        numeracao_eu: value,
        numeracao_us: preencherUsSeTipoSelecionado(numeracaoBr, value, s.us_variant),
      };
    });
  };

  const handleUsVariantChange = (variant: UsSizeVariant) => {
    setForm((s) => ({
      ...s,
      us_variant: variant,
      numeracao_us: numeracaoUsAoMudarTipo(
        s.numeracao_br,
        s.numeracao_eu,
        s.numeracao_us,
        s.us_variant,
        variant,
      ),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSalvando(true);
    setErro(null);
    try {
      const numeracaoBr = numOuNulo(form.numeracao_br);
      const numeracaoEu = numOuNulo(form.numeracao_eu);
      const numeracaoUs = form.numeracao_us.trim()
        ? normalizeNumeracaoUsInput(
            form.us_variant === "mens"
              ? form.numeracao_us
              : `${form.numeracao_us}${form.us_variant === "y" ? "Y" : "W"}`,
          )
        : null;

      const base = limparParaBanco({
        sku: form.sku,
        nome_produto: form.nome_produto,
        id_modelo_produto: form.id_modelo_produto,
        id_local_estoque: form.id_local_estoque || null,
        codigo_fornecedor: form.codigo_fornecedor,
        sistema_numeracao: inferirSistemaNumeracao(numeracaoBr, numeracaoEu, numeracaoUs),
        status_item: form.status_item,
        observacoes: form.observacoes,
      });
      const payload = {
        ...base,
        numeracao_br: numeracaoBr,
        numeracao_eu: numeracaoEu,
        numeracao_us: numeracaoUs,
      } as unknown as ItemEstoqueUpdate;

      await itensEstoqueService.atualizar(id, payload);
      navigate(`/itens-estoque/${id}`, { state: detalheState });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Editar item de estoque"
        titleAccessory={
          form.sku ? (
            <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-numeric text-xs font-semibold tabular-nums text-ink-muted">
              SKU {form.sku}
            </span>
          ) : null
        }
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Itens de estoque", to: returnToLista },
          { label: form.sku || "Editar" },
        ]}
        backTo={returnToLista}
      />

      {loadingInicial ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Carregando…</div>
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Produto e localização">
            <IdentificacaoItemFields
              sku={<SkuComGerador value={form.sku} onChange={(v) => upd("sku", v)} ignorarId={id} required />}
              nomeProduto={form.nome_produto}
              idModeloProduto={form.id_modelo_produto}
              idFornecedor=""
              idLocalEstoque={form.id_local_estoque}
              codigoFornecedor={form.codigo_fornecedor}
              modelos={modelos.data?.data ?? []}
              modeloVinculado={modeloVinculado}
              fornecedores={[]}
              locais={locais.data ?? []}
              loadingModelos={modelos.loading}
              loadingLocais={locais.loading}
              onModeloChange={handleModeloChange}
              onFornecedorChange={() => {}}
              onLocalChange={(v) => upd("id_local_estoque", v)}
              onCodigoFornecedorChange={(v) => upd("codigo_fornecedor", v)}
              showFornecedor={false}
              layoutEdicao
            />
          </SectionCard>

          <SectionCard title="Numeração">
            <NumeracaoOrdemCompraFields
              numeracaoBr={form.numeracao_br}
              numeracaoEu={form.numeracao_eu}
              numeracaoUs={form.numeracao_us}
              usVariant={form.us_variant}
              onBrChange={handleBrChange}
              onEuChange={handleEuChange}
              onUsVariantChange={handleUsVariantChange}
            />
          </SectionCard>

          <SectionCard title="Estado e observações">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <SearchableSelectDropdown
                  label="Status do item"
                  value={form.status_item}
                  onChange={(v) => upd("status_item", v as StatusItem)}
                  options={STATUS_OPCOES}
                  emptyLabel="— Selecione —"
                  searchPlaceholder="Buscar status…"
                />
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle/40 px-3 py-2">
                  <span className="text-xs text-ink-soft">Prévia:</span>
                  <StatusBadge value={form.status_item} />
                </div>
              </div>
              <FormTextarea
                label="Notas internas"
                rows={5}
                value={form.observacoes}
                onChange={(e) => upd("observacoes", e.target.value)}
                placeholder="Observações sobre este par…"
                hint="Visível apenas no CRM."
              />
            </div>
          </SectionCard>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <SecondaryButton
              type="button"
              onClick={() => navigate(returnToLista)}
            >
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              Salvar alterações
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
