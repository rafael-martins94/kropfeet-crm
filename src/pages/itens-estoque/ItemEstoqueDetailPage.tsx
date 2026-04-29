import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconTrash } from "../../components/Icons";
import { itensEstoqueService } from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { fornecedoresService } from "../../services/fornecedores";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { useAsync } from "../../hooks/useAsync";
import { formatarData, formatarDataHora, formatarMoeda } from "../../utils/format";

export default function ItemEstoqueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const item = useAsync(
    () => (id ? itensEstoqueService.obter(id) : Promise.resolve(null)),
    [id],
  );
  const modelo = useAsync(
    () =>
      item.data?.id_modelo_produto
        ? modelosProdutoService.obter(item.data.id_modelo_produto)
        : Promise.resolve(null),
    [item.data?.id_modelo_produto],
  );
  const fornecedor = useAsync(
    () =>
      item.data?.id_fornecedor
        ? fornecedoresService.obter(item.data.id_fornecedor)
        : Promise.resolve(null),
    [item.data?.id_fornecedor],
  );
  const local = useAsync(
    () =>
      item.data?.id_local_estoque
        ? locaisEstoqueService.obter(item.data.id_local_estoque)
        : Promise.resolve(null),
    [item.data?.id_local_estoque],
  );

  const handleDelete = async () => {
    if (!id || !item.data) return;
    if (!window.confirm(`Excluir o item SKU ${item.data.sku}?`)) return;
    try {
      await itensEstoqueService.deletar(id);
      navigate("/itens-estoque");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={item.data?.nome_completo ?? "Item"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Itens de estoque", to: "/itens-estoque" },
          { label: item.data?.sku ?? "…" },
        ]}
        backTo="/itens-estoque"
        actions={
          item.data ? (
            <SecondaryButton
              icon={<IconEdit width={16} height={16} />}
              onClick={() => navigate(`/itens-estoque/${item.data!.id}/editar`)}
            >
              Editar
            </SecondaryButton>
          ) : null
        }
      />

      {item.loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !item.data ? (
        <SectionCard><div className="text-sm text-ink-soft">Item não encontrado.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Status"
            actions={<StatusBadge value={item.data.status_item} />}
          >
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="SKU" value={item.data.sku} mono />
              <F label="Nome completo" value={item.data.nome_completo} />
              <F
                label="Modelo"
                value={
                  modelo.data ? (
                    <Link
                      to={`/modelos-produto/${modelo.data.id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {modelo.data.nome_modelo}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <F
                label="Fornecedor"
                value={
                  fornecedor.data ? (
                    <Link
                      to={`/fornecedores/${fornecedor.data.id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {fornecedor.data.nome}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <F
                label="Local de estoque"
                value={
                  local.data ? (
                    <Link
                      to={`/locais-estoque/${local.data.id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {local.data.nome}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <F label="Código do fabricante" value={item.data.codigo_fabricante ?? "—"} mono />
              <F
                label="Código (fornecedor)"
                value={item.data.codigo_produto_fornecedor ?? "—"}
                mono
              />
              <F label="ID Tiny" value={item.data.id_tiny ?? "—"} mono />
            </dl>
          </SectionCard>

          <SectionCard title="Numeração">
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <F label="Sistema" value={<StatusBadge value={item.data.sistema_numeracao} />} />
              <F label="BR" value={item.data.numeracao_br ?? "—"} />
              <F label="EU" value={item.data.numeracao_eu ?? "—"} />
              <F label="US" value={item.data.numeracao_us ?? "—"} />
            </dl>
          </SectionCard>

          <SectionCard title="Compra e precificação">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Data da compra" value={formatarData(item.data.data_compra)} />
              <F label="Moeda da compra" value={item.data.moeda_compra ?? "—"} />
              <F
                label="Valor pago (original)"
                value={formatarMoeda(item.data.valor_pago_original, item.data.moeda_compra ?? "BRL")}
              />
              <F label="Câmbio → BRL" value={item.data.cambio_compra_para_real ?? "—"} />
              <F label="Valor pago (BRL)" value={formatarMoeda(item.data.valor_pago_real, "BRL")} />
              <F label="Valor pago (EUR)" value={formatarMoeda(item.data.valor_pago_euro, "EUR")} />
            </dl>
          </SectionCard>

          <SectionCard title="Auditoria">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <F label="Cadastro no Tiny" value={formatarDataHora(item.data.data_cadastro_tiny)} />
              <F label="Criado em" value={formatarDataHora(item.data.criado_em)} />
              <F label="Atualizado em" value={formatarDataHora(item.data.atualizado_em)} />
              <F label="ID interno" value={item.data.id} mono />
            </dl>
          </SectionCard>

          {item.data.observacoes ? (
            <SectionCard title="Observações">
              <p className="whitespace-pre-wrap text-sm text-ink">{item.data.observacoes}</p>
            </SectionCard>
          ) : null}

          <SectionCard title="Exclusão">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm text-ink-soft">
                Remove este item do estoque de forma permanente. Esta ação não pode ser desfeita.
              </p>
              <DangerButton
                className="shrink-0 self-stretch sm:self-center"
                icon={<IconTrash width={16} height={16} />}
                onClick={handleDelete}
              >
                Excluir item
              </DangerButton>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function F({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs break-all" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
