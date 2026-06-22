import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FormTextarea } from "../../components/FormField";
import { IdentificacaoItemFields } from "../../components/item-estoque-form/IdentificacaoItemFields";
import { SkuComGerador } from "../../components/item-estoque-form/SkuComGerador";
import { CompraOrdemFields } from "../../components/ordens-compra/CompraOrdemFields";
import { NumeracaoOrdemCompraFields } from "../../components/ordens-compra/NumeracaoOrdemCompraFields";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { useAsync } from "../../hooks/useAsync";
import { fornecedoresService } from "../../services/fornecedores";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { ordensCompraService } from "../../services/ordens-compra";
import {
  montarNomeProdutoComNumeracoes,
  normalizeNumeracaoUsInput,
  normalizeSizeValue,
  aplicarEquivalenciaBrEuForm,
  inferirSistemaNumeracao,
  numeracaoUsAoMudarTipo,
  type UsSizeVariant,
} from "../../utils/sizeConversion";

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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

type FormState = {
  sku: string;
  nome_produto: string;
  id_modelo_produto: string;
  id_fornecedor: string;
  id_local_estoque: string;
  codigo_fornecedor: string;
  numeracao_br: string;
  numeracao_eu: string;
  numeracao_us: string;
  us_variant: UsSizeVariant | "";
  observacoes_item: string;
  data_compra: string;
  moeda_compra: string;
  valor_pago_original: string;
  valor_pago_real: string;
  valor_pago_euro: string;
  cambio_compra_para_real: string;
  cambio_compra_para_euro: string;
  observacoes_ordem: string;
};

const vazio: FormState = {
  sku: "",
  nome_produto: "",
  id_modelo_produto: "",
  id_fornecedor: "",
  id_local_estoque: "",
  codigo_fornecedor: "",
  numeracao_br: "",
  numeracao_eu: "",
  numeracao_us: "",
  us_variant: "" as UsSizeVariant | "",
  observacoes_item: "",
  data_compra: hojeIso(),
  moeda_compra: "EUR",
  valor_pago_original: "",
  valor_pago_real: "",
  valor_pago_euro: "",
  cambio_compra_para_real: "",
  cambio_compra_para_euro: "",
  observacoes_ordem: "",
};

export default function OrdemCompraFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modelos = useAsync(
    () =>
      modelosProdutoService.listar({ page: 1, pageSize: 500, orderBy: "nome_modelo", ascending: true }),
    [],
  );
  const fornecedores = useAsync(() => fornecedoresService.listarAtivos(), []);
  const locais = useAsync(() => locaisEstoqueService.listarTodos(), []);

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

  const handleModeloChange = (id: string) => {
    const modelo = (modelos.data?.data ?? []).find((m) => m.id === id);
    setForm((s) => ({
      ...s,
      id_modelo_produto: id,
      codigo_fornecedor: modelo?.codigo_fabricante ?? "",
    }));
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

  const handleValoresCalculados = useCallback(
    (valores: {
      valorReal: string;
      valorEuro: string;
      cambioReal: string;
      cambioEuro: string;
    }) => {
      setForm((s) => ({
        ...s,
        valor_pago_real: valores.valorReal,
        valor_pago_euro: valores.valorEuro,
        cambio_compra_para_real: valores.cambioReal,
        cambio_compra_para_euro: valores.cambioEuro,
      }));
    },
    [],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      if (!form.codigo_fornecedor.trim()) {
        throw new Error("Informe o código do fornecedor.");
      }
      if (!form.id_modelo_produto) {
        throw new Error("Selecione um modelo de produto.");
      }
      const valorOriginal = numOuNulo(form.valor_pago_original);
      if (valorOriginal === null) {
        throw new Error("Informe o valor pago na moeda original.");
      }

      if (!form.us_variant) {
        throw new Error("Selecione o tipo US (M, Y ou W).");
      }
      if (!form.numeracao_us.trim()) {
        throw new Error(
          "Informe BR ou EU válidos e selecione o tipo US para preencher a numeração americana.",
        );
      }

      const numeracaoUs = normalizeNumeracaoUsInput(
        form.us_variant === "mens"
          ? form.numeracao_us
          : `${form.numeracao_us}${form.us_variant === "y" ? "Y" : "W"}`,
      );

      const numeracaoBr = numOuNulo(form.numeracao_br);
      const numeracaoEu = numOuNulo(form.numeracao_eu);

      const resultado = await ordensCompraService.criarComItem({
        sku: form.sku.trim(),
        nome_produto: form.nome_produto.trim(),
        id_modelo_produto: form.id_modelo_produto,
        id_local_estoque: form.id_local_estoque || null,
        codigo_fornecedor: form.codigo_fornecedor.trim(),
        numeracao_br: numeracaoBr,
        numeracao_eu: numeracaoEu,
        numeracao_us: numeracaoUs,
        sistema_numeracao: inferirSistemaNumeracao(numeracaoBr, numeracaoEu, numeracaoUs),
        observacoes_item: form.observacoes_item.trim() || null,
        id_fornecedor: form.id_fornecedor || null,
        data_compra: form.data_compra,
        moeda_compra: form.moeda_compra,
        valor_pago_original: valorOriginal,
        cambio_compra_para_real: numOuNulo(form.cambio_compra_para_real),
        cambio_compra_para_euro: numOuNulo(form.cambio_compra_para_euro),
        valor_pago_real: numOuNulo(form.valor_pago_real),
        valor_pago_euro: numOuNulo(form.valor_pago_euro),
        observacoes_ordem: form.observacoes_ordem.trim() || null,
      });

      navigate(`/ordens-compra/${resultado.id_ordem}`, { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Nova ordem de compra"
        breadcrumbs={[
          { label: "Operação" },
          { label: "Ordens de compra", to: "/ordens-compra" },
          { label: "Nova" },
        ]}
        backTo="/ordens-compra"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title="Identificação do item">
          <IdentificacaoItemFields
            sku={<SkuComGerador value={form.sku} onChange={(v) => upd("sku", v)} required />}
            nomeProduto={form.nome_produto}
            idModeloProduto={form.id_modelo_produto}
            idFornecedor={form.id_fornecedor}
            idLocalEstoque={form.id_local_estoque}
            codigoFornecedor={form.codigo_fornecedor}
            modelos={modelos.data?.data ?? []}
            fornecedores={fornecedores.data ?? []}
            locais={locais.data ?? []}
            loadingModelos={modelos.loading}
            loadingFornecedores={fornecedores.loading}
            loadingLocais={locais.loading}
            onModeloChange={handleModeloChange}
            onFornecedorChange={(v) => upd("id_fornecedor", v)}
            onLocalChange={(v) => upd("id_local_estoque", v)}
            onCodigoFornecedorChange={(v) => upd("codigo_fornecedor", v)}
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

        <SectionCard title="Compra">
          <CompraOrdemFields
            dataCompra={form.data_compra}
            moedaCompra={form.moeda_compra}
            valorOriginal={form.valor_pago_original}
            valorReal={form.valor_pago_real}
            valorEuro={form.valor_pago_euro}
            cambioReal={form.cambio_compra_para_real}
            cambioEuro={form.cambio_compra_para_euro}
            onDataChange={(v) => upd("data_compra", v)}
            onMoedaChange={(v) => upd("moeda_compra", v)}
            onValorOriginalChange={(v) => upd("valor_pago_original", v)}
            onValoresCalculados={handleValoresCalculados}
          />
        </SectionCard>

        <SectionCard title="Observações">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormTextarea
              label="Notas do item"
              rows={3}
              value={form.observacoes_item}
              onChange={(e) => upd("observacoes_item", e.target.value)}
            />
            <FormTextarea
              label="Notas da ordem"
              rows={3}
              value={form.observacoes_ordem}
              onChange={(e) => upd("observacoes_ordem", e.target.value)}
            />
          </div>
        </SectionCard>

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <SecondaryButton type="button" onClick={() => navigate("/ordens-compra")}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" loading={salvando}>
            Criar ordem e item
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
