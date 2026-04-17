import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput, FormSelect, FormTextarea } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { itensEstoqueService } from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { fornecedoresService } from "../../services/fornecedores";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { useAsync } from "../../hooks/useAsync";
import { limparParaBanco } from "../../utils/format";
import type {
  CondicaoItem,
  ItemEstoqueInsert,
  SistemaNumeracao,
  StatusItem,
} from "../../types/entities";

type FormState = {
  sku: string;
  nome_completo: string;
  id_modelo_produto: string;
  id_fornecedor: string;
  id_local_estoque: string;
  codigo_fabricante: string;
  codigo_produto_fornecedor: string;
  numeracao_br: string;
  numeracao_eu: string;
  numeracao_us: string;
  sistema_numeracao: SistemaNumeracao;
  status_item: StatusItem;
  condicao_item: CondicaoItem;
  data_compra: string;
  moeda_compra: string;
  valor_pago_original: string;
  cambio_compra_para_real: string;
  valor_pago_real: string;
  valor_pago_euro: string;
  preco_sugerido_real: string;
  preco_sugerido_euro: string;
  observacoes: string;
};

const vazio: FormState = {
  sku: "",
  nome_completo: "",
  id_modelo_produto: "",
  id_fornecedor: "",
  id_local_estoque: "",
  codigo_fabricante: "",
  codigo_produto_fornecedor: "",
  numeracao_br: "",
  numeracao_eu: "",
  numeracao_us: "",
  sistema_numeracao: "br",
  status_item: "em_estoque",
  condicao_item: "novo",
  data_compra: "",
  moeda_compra: "",
  valor_pago_original: "",
  cambio_compra_para_real: "",
  valor_pago_real: "",
  valor_pago_euro: "",
  preco_sugerido_real: "",
  preco_sugerido_euro: "",
  observacoes: "",
};

function numOuNulo(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

export default function ItemEstoqueFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(vazio);
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modelos = useAsync(
    () =>
      modelosProdutoService.listar({ page: 1, pageSize: 500, orderBy: "nome_modelo", ascending: true }),
    [],
  );
  const fornecedores = useAsync(() => fornecedoresService.listarAtivos(), []);
  const locais = useAsync(() => locaisEstoqueService.listarTodos(), []);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    itensEstoqueService
      .obter(id)
      .then((it) => {
        if (!it) return;
        setForm({
          sku: it.sku,
          nome_completo: it.nome_completo,
          id_modelo_produto: it.id_modelo_produto,
          id_fornecedor: it.id_fornecedor ?? "",
          id_local_estoque: it.id_local_estoque ?? "",
          codigo_fabricante: it.codigo_fabricante ?? "",
          codigo_produto_fornecedor: it.codigo_produto_fornecedor ?? "",
          numeracao_br: it.numeracao_br?.toString() ?? "",
          numeracao_eu: it.numeracao_eu?.toString() ?? "",
          numeracao_us: it.numeracao_us?.toString() ?? "",
          sistema_numeracao: it.sistema_numeracao,
          status_item: it.status_item,
          condicao_item: it.condicao_item,
          data_compra: it.data_compra ?? "",
          moeda_compra: it.moeda_compra ?? "",
          valor_pago_original: it.valor_pago_original?.toString() ?? "",
          cambio_compra_para_real: it.cambio_compra_para_real?.toString() ?? "",
          valor_pago_real: it.valor_pago_real?.toString() ?? "",
          valor_pago_euro: it.valor_pago_euro?.toString() ?? "",
          preco_sugerido_real: it.preco_sugerido_real?.toString() ?? "",
          preco_sugerido_euro: it.preco_sugerido_euro?.toString() ?? "",
          observacoes: it.observacoes ?? "",
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const base = limparParaBanco({
        sku: form.sku,
        nome_completo: form.nome_completo,
        id_modelo_produto: form.id_modelo_produto,
        id_fornecedor: form.id_fornecedor || null,
        id_local_estoque: form.id_local_estoque || null,
        codigo_fabricante: form.codigo_fabricante,
        codigo_produto_fornecedor: form.codigo_produto_fornecedor,
        sistema_numeracao: form.sistema_numeracao,
        status_item: form.status_item,
        condicao_item: form.condicao_item,
        moeda_compra: form.moeda_compra,
        observacoes: form.observacoes,
      });
      const payload = {
        ...base,
        numeracao_br: numOuNulo(form.numeracao_br),
        numeracao_eu: numOuNulo(form.numeracao_eu),
        numeracao_us: numOuNulo(form.numeracao_us),
        data_compra: form.data_compra || null,
        valor_pago_original: numOuNulo(form.valor_pago_original),
        cambio_compra_para_real: numOuNulo(form.cambio_compra_para_real),
        valor_pago_real: numOuNulo(form.valor_pago_real),
        valor_pago_euro: numOuNulo(form.valor_pago_euro),
        preco_sugerido_real: numOuNulo(form.preco_sugerido_real),
        preco_sugerido_euro: numOuNulo(form.preco_sugerido_euro),
      } as unknown as ItemEstoqueInsert;

      if (id) {
        await itensEstoqueService.atualizar(id, payload);
      } else {
        const it = await itensEstoqueService.criar(payload);
        navigate(`/itens-estoque/${it.id}`, { replace: true });
        return;
      }
      navigate("/itens-estoque");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={edicao ? "Editar item de estoque" : "Novo item de estoque"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Itens de estoque", to: "/itens-estoque" },
          { label: edicao ? "Editar" : "Novo" },
        ]}
        backTo="/itens-estoque"
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Identificação do item">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="SKU"
                required
                value={form.sku}
                onChange={(e) => upd("sku", e.target.value)}
              />
              <FormInput
                label="Nome completo"
                required
                value={form.nome_completo}
                onChange={(e) => upd("nome_completo", e.target.value)}
              />
              <FormSelect
                label="Modelo de produto"
                required
                value={form.id_modelo_produto}
                onChange={(e) => upd("id_modelo_produto", e.target.value)}
                placeholder="— Selecione o modelo —"
                options={(modelos.data?.data ?? []).map((m) => ({
                  value: m.id,
                  label: m.nome_modelo,
                }))}
                wrapperClassName="sm:col-span-2"
              />
              <FormSelect
                label="Fornecedor"
                value={form.id_fornecedor}
                onChange={(e) => upd("id_fornecedor", e.target.value)}
                placeholder="— Nenhum —"
                options={(fornecedores.data ?? []).map((f) => ({
                  value: f.id,
                  label: f.nome,
                }))}
              />
              <FormSelect
                label="Local de estoque"
                value={form.id_local_estoque}
                onChange={(e) => upd("id_local_estoque", e.target.value)}
                placeholder="— Nenhum —"
                options={(locais.data ?? []).map((l) => ({
                  value: l.id,
                  label: `${l.codigo} · ${l.nome}`,
                }))}
              />
              <FormInput
                label="Código do fabricante"
                value={form.codigo_fabricante}
                onChange={(e) => upd("codigo_fabricante", e.target.value)}
              />
              <FormInput
                label="Código do produto (fornecedor)"
                value={form.codigo_produto_fornecedor}
                onChange={(e) => upd("codigo_produto_fornecedor", e.target.value)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Numeração e estado">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <FormInput
                label="Numeração BR"
                value={form.numeracao_br}
                onChange={(e) => upd("numeracao_br", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Numeração EU"
                value={form.numeracao_eu}
                onChange={(e) => upd("numeracao_eu", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Numeração US"
                value={form.numeracao_us}
                onChange={(e) => upd("numeracao_us", e.target.value)}
                inputMode="decimal"
              />
              <FormSelect
                label="Sistema de numeração"
                value={form.sistema_numeracao}
                onChange={(e) => upd("sistema_numeracao", e.target.value as SistemaNumeracao)}
                options={[
                  { value: "br", label: "BR" },
                  { value: "eu", label: "EU" },
                  { value: "us", label: "US" },
                  { value: "outro", label: "Outro" },
                ]}
              />
              <FormSelect
                label="Status"
                value={form.status_item}
                onChange={(e) => upd("status_item", e.target.value as StatusItem)}
                options={[
                  { value: "em_estoque", label: "Em estoque" },
                  { value: "reservado", label: "Reservado" },
                  { value: "vendido", label: "Vendido" },
                  { value: "devolvido", label: "Devolvido" },
                  { value: "inativo", label: "Inativo" },
                  { value: "aguardando_chegada", label: "Aguardando chegada" },
                ]}
              />
              <FormSelect
                label="Condição"
                value={form.condicao_item}
                onChange={(e) => upd("condicao_item", e.target.value as CondicaoItem)}
                options={[
                  { value: "novo", label: "Novo" },
                  { value: "seminovo", label: "Seminovo" },
                  { value: "usado", label: "Usado" },
                  { value: "defeituoso", label: "Defeituoso" },
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Compra e precificação">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormInput
                label="Data da compra"
                type="date"
                value={form.data_compra}
                onChange={(e) => upd("data_compra", e.target.value)}
              />
              <FormInput
                label="Moeda da compra"
                value={form.moeda_compra}
                onChange={(e) => upd("moeda_compra", e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="BRL, USD, EUR…"
              />
              <FormInput
                label="Valor pago (moeda original)"
                value={form.valor_pago_original}
                onChange={(e) => upd("valor_pago_original", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Câmbio → BRL"
                value={form.cambio_compra_para_real}
                onChange={(e) => upd("cambio_compra_para_real", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Valor pago (BRL)"
                value={form.valor_pago_real}
                onChange={(e) => upd("valor_pago_real", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Valor pago (EUR)"
                value={form.valor_pago_euro}
                onChange={(e) => upd("valor_pago_euro", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Preço sugerido (BRL)"
                value={form.preco_sugerido_real}
                onChange={(e) => upd("preco_sugerido_real", e.target.value)}
                inputMode="decimal"
              />
              <FormInput
                label="Preço sugerido (EUR)"
                value={form.preco_sugerido_euro}
                onChange={(e) => upd("preco_sugerido_euro", e.target.value)}
                inputMode="decimal"
              />
            </div>
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
            <SecondaryButton type="button" onClick={() => navigate("/itens-estoque")}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Criar item"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
