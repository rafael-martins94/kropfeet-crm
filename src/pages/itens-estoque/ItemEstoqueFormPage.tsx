import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormTextarea } from "../../components/FormField";
import { IdentificacaoItemFields } from "../../components/item-estoque-form/IdentificacaoItemFields";
import { NumeracaoItemFields } from "../../components/item-estoque-form/NumeracaoItemFields";
import { SkuComGerador } from "../../components/item-estoque-form/SkuComGerador";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { itensEstoqueService } from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { useAsync } from "../../hooks/useAsync";
import { limparParaBanco } from "../../utils/format";
import {
  montarNomeProdutoComNumeracoes,
  normalizeNumeracaoUsInput,
  normalizeSizeValue,
  parseNumeracaoUs,
  aplicarEquivalenciaBrEuForm,
  numeracaoUsAoMudarTipo,
  type UsSizeVariant,
} from "../../utils/sizeConversion";
import type { ItemEstoqueUpdate, SistemaNumeracao, StatusItem } from "../../types/entities";

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
  sistema_numeracao: SistemaNumeracao;
  status_item: StatusItem;
  observacoes: string;
};

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
  sistema_numeracao: "br",
  status_item: "em_estoque",
  observacoes: "",
};

function numOuNulo(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

export default function ItemEstoqueFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(vazio);
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
      .then((it) => {
        if (!it) return;
        const usParsed = parseNumeracaoUs(it.numeracao_us);
        setForm({
          sku: it.sku,
          nome_produto: it.nome_produto,
          id_modelo_produto: it.id_modelo_produto,
          id_local_estoque: it.id_local_estoque ?? "",
          codigo_fornecedor: it.codigo_fornecedor ?? "",
          numeracao_br: it.numeracao_br?.toString() ?? "",
          numeracao_eu: it.numeracao_eu?.toString() ?? "",
          numeracao_us: usParsed ? String(usParsed.value).replace(".", ",") : "",
          us_variant: usParsed?.variant ?? "mens",
          sistema_numeracao: it.sistema_numeracao,
          status_item: it.status_item,
          observacoes: it.observacoes ?? "",
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id, navigate]);

  const modeloSelecionado = (modelos.data?.data ?? []).find((m) => m.id === form.id_modelo_produto);

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
    const modelo = (modelos.data?.data ?? []).find((m) => m.id === modeloId);
    setForm((s) => ({
      ...s,
      id_modelo_produto: modeloId,
      codigo_fornecedor: modelo?.codigo_fabricante ?? s.codigo_fornecedor,
    }));
  };

  const handleBrChange = (value: string) => {
    setForm((s) => {
      const eq = aplicarEquivalenciaBrEuForm("br", value);
      if (!eq) return { ...s, numeracao_br: value, numeracao_us: "" };
      return { ...s, ...eq, numeracao_br: value, numeracao_us: "" };
    });
  };

  const handleEuChange = (value: string) => {
    setForm((s) => {
      const eq = aplicarEquivalenciaBrEuForm("eu", value);
      if (!eq) return { ...s, numeracao_eu: value, numeracao_us: "" };
      return { ...s, ...eq, numeracao_eu: value, numeracao_us: "" };
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

  const handleSistemaChange = (sistema: SistemaNumeracao) => {
    setForm((s) => {
      if (sistema === "outro" || sistema === "us") {
        return { ...s, sistema_numeracao: sistema, numeracao_us: "" };
      }
      const valorCampo = sistema === "br" ? s.numeracao_br : s.numeracao_eu;
      const eq = aplicarEquivalenciaBrEuForm(sistema, valorCampo);
      if (!eq) return { ...s, sistema_numeracao: sistema, numeracao_us: "" };
      return { ...s, ...eq, sistema_numeracao: sistema, numeracao_us: "" };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSalvando(true);
    setErro(null);
    try {
      const base = limparParaBanco({
        sku: form.sku,
        nome_produto: form.nome_produto,
        id_modelo_produto: form.id_modelo_produto,
        id_local_estoque: form.id_local_estoque || null,
        codigo_fornecedor: form.codigo_fornecedor,
        sistema_numeracao: form.sistema_numeracao,
        status_item: form.status_item,
        observacoes: form.observacoes,
      });
      const payload = {
        ...base,
        numeracao_br: numOuNulo(form.numeracao_br),
        numeracao_eu: numOuNulo(form.numeracao_eu),
        numeracao_us: form.numeracao_us.trim()
          ? normalizeNumeracaoUsInput(
              form.us_variant === "mens"
                ? form.numeracao_us
                : `${form.numeracao_us}${form.us_variant === "y" ? "Y" : "W"}`,
            )
          : null,
      } as unknown as ItemEstoqueUpdate;

      await itensEstoqueService.atualizar(id, payload);
      navigate(`/itens-estoque/${id}`);
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
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Itens de estoque", to: "/itens-estoque" },
          { label: "Editar" },
        ]}
        backTo={id ? `/itens-estoque/${id}` : "/itens-estoque"}
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Identificação do item">
            <IdentificacaoItemFields
              sku={<SkuComGerador value={form.sku} onChange={(v) => upd("sku", v)} required />}
              nomeProduto={form.nome_produto}
              idModeloProduto={form.id_modelo_produto}
              idFornecedor=""
              idLocalEstoque={form.id_local_estoque}
              codigoFornecedor={form.codigo_fornecedor}
              modelos={modelos.data?.data ?? []}
              fornecedores={[]}
              locais={locais.data ?? []}
              loadingModelos={modelos.loading}
              loadingLocais={locais.loading}
              onModeloChange={handleModeloChange}
              onFornecedorChange={() => {}}
              onLocalChange={(v) => upd("id_local_estoque", v)}
              onCodigoFornecedorChange={(v) => upd("codigo_fornecedor", v)}
              showFornecedor={false}
            />
          </SectionCard>

          <SectionCard title="Numeração e estado">
            <NumeracaoItemFields
              numeracaoBr={form.numeracao_br}
              numeracaoEu={form.numeracao_eu}
              numeracaoUs={form.numeracao_us}
              usVariant={form.us_variant}
              sistemaNumeracao={form.sistema_numeracao}
              statusItem={form.status_item}
              onBrChange={handleBrChange}
              onEuChange={handleEuChange}
              onUsVariantChange={handleUsVariantChange}
              onSistemaChange={handleSistemaChange}
              onStatusChange={(v) => upd("status_item", v)}
              usPreenchidoPorTipo
            />
          </SectionCard>

          <SectionCard title="Observações">
            <FormTextarea
              label="Notas internas"
              rows={4}
              value={form.observacoes}
              onChange={(e) => upd("observacoes", e.target.value)}
            />
          </SectionCard>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <SecondaryButton type="button" onClick={() => navigate(id ? `/itens-estoque/${id}` : "/itens-estoque")}>
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
