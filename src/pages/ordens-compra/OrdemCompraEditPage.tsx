import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormTextarea } from "../../components/FormField";
import { CompraOrdemFields } from "../../components/ordens-compra/CompraOrdemFields";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { useAsync } from "../../hooks/useAsync";
import { fornecedoresService } from "../../services/fornecedores";
import { ordensCompraService } from "../../services/ordens-compra";

function numOuNulo(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

type FormState = {
  id_fornecedor: string;
  data_compra: string;
  moeda_compra: string;
  valor_custo: string;
  observacoes: string;
};

const vazio: FormState = {
  id_fornecedor: "",
  data_compra: "",
  moeda_compra: "EUR",
  valor_custo: "",
  observacoes: "",
};

export default function OrdemCompraEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(vazio);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ordem = useAsync(
    () => (id ? ordensCompraService.obter(id) : Promise.resolve(null)),
    [id],
  );
  const fornecedores = useAsync(() => fornecedoresService.listarAtivos(), []);

  useEffect(() => {
    if (!ordem.data || carregado) return;
    setForm({
      id_fornecedor: ordem.data.id_fornecedor ?? "",
      data_compra: ordem.data.data_compra,
      moeda_compra: ordem.data.moeda_compra,
      valor_custo: String(ordem.data.valor_custo ?? ""),
      observacoes: ordem.data.observacoes ?? "",
    });
    setCarregado(true);
  }, [ordem.data, carregado]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSalvando(true);
    setErro(null);

    try {
      if (!form.id_fornecedor) {
        throw new Error("Selecione o fornecedor da compra.");
      }
      if (!form.data_compra) {
        throw new Error("Informe a data da compra.");
      }
      if (!form.moeda_compra || !["EUR", "BRL"].includes(form.moeda_compra)) {
        throw new Error("Selecione a moeda da compra (EUR ou BRL).");
      }
      const valorCusto = numOuNulo(form.valor_custo);
      if (valorCusto === null || valorCusto < 0) {
        throw new Error("Informe um valor de custo válido.");
      }

      await ordensCompraService.atualizar(id, {
        id_fornecedor: form.id_fornecedor,
        data_compra: form.data_compra,
        moeda_compra: form.moeda_compra,
        valor_custo: valorCusto,
        observacoes: form.observacoes.trim() || null,
      });

      navigate(`/ordens-compra/${id}`, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const item = ordem.data?.item;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Editar ordem de compra"
        breadcrumbs={[
          { label: "Operação" },
          { label: "Ordens de compra", to: "/ordens-compra" },
          {
            label: item?.codigo_fornecedor ?? item?.sku ?? "…",
            to: id ? `/ordens-compra/${id}` : undefined,
          },
          { label: "Editar" },
        ]}
        backTo={id ? `/ordens-compra/${id}` : "/ordens-compra"}
      />

      {ordem.loading && !carregado ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Carregando…</div>
        </SectionCard>
      ) : !ordem.data && !ordem.loading ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Ordem não encontrada.</div>
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {item ? (
            <SectionCard
              title="Item vinculado"
              description="SKU e numeração são editados no cadastro do item."
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.nome_produto}</p>
                  <p className="mt-0.5 font-numeric text-xs tabular-nums text-ink-muted">
                    SKU {item.sku}
                    {item.codigo_fornecedor ? ` · Cód. ${item.codigo_fornecedor}` : ""}
                  </p>
                </div>
                <Link
                  to={`/itens-estoque/${item.id}/editar`}
                  className="text-sm font-medium text-brand-700 hover:text-brand-800"
                >
                  Editar item
                </Link>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Dados da compra"
            description="Fornecedor, data, moeda e valor de custo desta ordem."
          >
            <CompraOrdemFields
              dataCompra={form.data_compra}
              moedaCompra={form.moeda_compra}
              valorCusto={form.valor_custo}
              idFornecedor={form.id_fornecedor}
              fornecedores={fornecedores.data ?? []}
              loadingFornecedores={fornecedores.loading}
              onDataChange={(v) => upd("data_compra", v)}
              onMoedaChange={(v) => upd("moeda_compra", v)}
              onValorCustoChange={(v) => upd("valor_custo", v)}
              onFornecedorChange={(v) => upd("id_fornecedor", v)}
            />
          </SectionCard>

          <SectionCard title="Observações">
            <FormTextarea
              label="Notas da ordem"
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
            <SecondaryButton
              type="button"
              onClick={() => navigate(id ? `/ordens-compra/${id}` : "/ordens-compra")}
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
