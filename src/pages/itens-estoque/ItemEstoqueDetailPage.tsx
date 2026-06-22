import { Link, useNavigate, useParams } from "react-router-dom";
import { ModeloImagensGaleria } from "../../components/item-estoque-form/ModeloImagensGaleria";
import { PageHeader } from "../../components/PageHeader";
import { SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconEye } from "../../components/Icons";
import { itensEstoqueService } from "../../services/itens-estoque";
import { modelosProdutoService } from "../../services/modelos-produto";
import { fornecedoresService } from "../../services/fornecedores";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { ordensCompraService } from "../../services/ordens-compra";
import { useAsync } from "../../hooks/useAsync";
import { useListReturnTo } from "../../hooks/useListDetailNavigation";
import { cn } from "../../utils/cn";
import { formatarData, formatarDataHora, formatarMoeda } from "../../utils/format";
import {
  formatSizeLabel,
  getAllSizeEquivalences,
  getUsDisplayLabel,
} from "../../utils/sizeConversion";

export default function ItemEstoqueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const returnToLista = useListReturnTo("/itens-estoque");

  const item = useAsync(
    () => (id ? itensEstoqueService.obter(id) : Promise.resolve(null)),
    [id],
  );
  const ordem = useAsync(
    () =>
      item.data?.id_ordem_compra
        ? ordensCompraService.obter(item.data.id_ordem_compra)
        : Promise.resolve(null),
    [item.data?.id_ordem_compra],
  );
  const modelo = useAsync(
    () =>
      item.data?.id_modelo_produto
        ? modelosProdutoService.obter(item.data.id_modelo_produto)
        : Promise.resolve(null),
    [item.data?.id_modelo_produto],
  );
  const imagens = useAsync(
    () =>
      item.data?.id_modelo_produto
        ? modelosProdutoService.obterImagens(item.data.id_modelo_produto)
        : Promise.resolve([]),
    [item.data?.id_modelo_produto],
  );
  const fornecedor = useAsync(
    () => {
      const idFornecedor = ordem.data?.id_fornecedor ?? item.data?.id_fornecedor;
      return idFornecedor ? fornecedoresService.obter(idFornecedor) : Promise.resolve(null);
    },
    [ordem.data?.id_fornecedor, item.data?.id_fornecedor],
  );
  const local = useAsync(
    () =>
      item.data?.id_local_estoque
        ? locaisEstoqueService.obter(item.data.id_local_estoque)
        : Promise.resolve(null),
    [item.data?.id_local_estoque],
  );

  const temOrdem = Boolean(item.data?.id_ordem_compra && ordem.data);
  const temCustoLegado =
    !temOrdem &&
    item.data?.valor_pago_original != null &&
    item.data.valor_pago_original !== 0;

  const equivalencias = item.data ? getAllSizeEquivalences(item.data) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={modelo.data?.nome_modelo ?? item.data?.nome_produto ?? "Item"}
        titleAccessory={
          item.data ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-numeric text-xs font-semibold tabular-nums text-ink-muted">
                SKU {item.data.sku}
              </span>
              <StatusBadge value={item.data.status_item} />
            </div>
          ) : null
        }
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Itens de estoque", to: returnToLista },
          { label: item.data?.sku ?? "…" },
        ]}
        backTo={returnToLista}
        actions={
          item.data ? (
            <SecondaryButton
              icon={<IconEdit width={16} height={16} />}
              onClick={() =>
                navigate(`/itens-estoque/${item.data!.id}/editar`, {
                  state: { returnTo: returnToLista },
                })
              }
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
          <SectionCard noPadding>
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
              <div className="flex flex-col gap-6 border-b border-line p-5 lg:border-b-0 lg:border-r lg:p-6">
                <div className="space-y-2">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                    Nome completo
                  </p>
                  <p className="text-sm leading-relaxed text-ink">{item.data.nome_produto}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <ChipNumeracao
                    label="BR"
                    valor={formatSizeLabel(equivalencias?.br ?? null, "br")}
                  />
                  <ChipNumeracao
                    label="EU"
                    valor={formatSizeLabel(equivalencias?.eu ?? null, "eu")}
                  />
                  <ChipNumeracao label="US" valor={getUsDisplayLabel(item.data)} />
                </div>

                {modelo.data ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-line bg-brand-50/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
                        Modelo vinculado
                      </p>
                      <p className="mt-1 truncate text-base font-semibold text-ink">
                        {modelo.data.nome_modelo}
                      </p>
                    </div>
                    <Link
                      to={`/modelos-produto/${modelo.data.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "btn-secondary shrink-0 self-start sm:self-center",
                      )}
                    >
                      <IconEye width={16} height={16} />
                      Ver modelo
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line bg-surface-muted/30 px-4 py-3 text-sm text-ink-soft">
                    Nenhum modelo vinculado a este item.
                  </div>
                )}

                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <F label="Local de estoque">
                    {local.data ? (
                      <Link
                        to={`/locais-estoque/${local.data.id}`}
                        className="text-brand-600 hover:text-brand-700"
                      >
                        {local.data.nome}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </F>
                  <F label="Código do fornecedor" mono>
                    {item.data.codigo_fornecedor ?? "—"}
                  </F>
                  {!temOrdem && fornecedor.data ? (
                    <F label="Fornecedor (legado)">
                      <Link
                        to={`/fornecedores/${fornecedor.data.id}`}
                        className="text-brand-600 hover:text-brand-700"
                      >
                        {fornecedor.data.nome}
                      </Link>
                    </F>
                  ) : null}
                  <F label="ID Tiny" mono>
                    {item.data.id_tiny ?? "—"}
                  </F>
                </dl>
              </div>

              <div className="p-4 sm:p-5 lg:p-6">
                <ModeloImagensGaleria
                  idModelo={item.data.id_modelo_produto}
                  imagens={imagens.data ?? []}
                  nomeModelo={modelo.data?.nome_modelo}
                  loading={imagens.loading}
                  aspectRatio="16/9"
                  keyboardNav
                  className="w-full"
                />
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {temOrdem && ordem.data ? (
              <SectionCard title="Origem da compra">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <F label="Ordem de compra">
                    <Link
                      to={`/ordens-compra/${ordem.data.id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      Ver ordem ({formatarData(ordem.data.data_compra)})
                    </Link>
                  </F>
                  <F label="Fornecedor">
                    {fornecedor.data ? (
                      <Link
                        to={`/fornecedores/${fornecedor.data.id}`}
                        className="text-brand-600 hover:text-brand-700"
                      >
                        {fornecedor.data.nome}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </F>
                  <F label="Moeda">{ordem.data.moeda_compra}</F>
                  <F label="Valor pago (original)">
                    {formatarMoeda(ordem.data.valor_pago_original, ordem.data.moeda_compra)}
                  </F>
                  <F label="Câmbio → BRL" mono>
                    {ordem.data.cambio_compra_para_real ?? "—"}
                  </F>
                  <F label="Valor pago (BRL)">
                    {formatarMoeda(ordem.data.valor_pago_real, "BRL")}
                  </F>
                  <F label="Câmbio → EUR" mono>
                    {ordem.data.cambio_compra_para_euro ?? "—"}
                  </F>
                  <F label="Valor pago (EUR)">
                    {formatarMoeda(ordem.data.valor_pago_euro, "EUR")}
                  </F>
                </dl>
              </SectionCard>
            ) : null}

            {temCustoLegado ? (
              <SectionCard title="Custo (Tiny)">
                <dl className="grid grid-cols-1 gap-5">
                  <F label="Valor de custo">
                    {formatarMoeda(item.data.valor_pago_original, "BRL")}
                  </F>
                </dl>
                <p className="mt-3 text-xs text-ink-soft">
                  Custo importado do Tiny (legado). Itens sem ordem de compra não possuem detalhes de
                  moeda ou câmbio.
                </p>
              </SectionCard>
            ) : null}

            <SectionCard title="Auditoria" className={cn(!temOrdem && !temCustoLegado && "lg:col-span-2")}>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <F label="Cadastro no Tiny">{formatarDataHora(item.data.data_cadastro_tiny)}</F>
                <F label="Criado em">{formatarDataHora(item.data.criado_em)}</F>
                <F label="Atualizado em">{formatarDataHora(item.data.atualizado_em)}</F>
                <F label="ID interno" mono>
                  {item.data.id}
                </F>
              </dl>
            </SectionCard>

            {item.data.observacoes ? (
              <SectionCard title="Observações" className="lg:col-span-2">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {item.data.observacoes}
                </p>
              </SectionCard>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipNumeracao({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3 text-center shadow-sm">
      <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-1 font-numeric text-lg font-semibold tabular-nums text-ink">{valor}</p>
    </div>
  );
}

function F({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm text-ink",
          mono && "font-numeric tabular-nums text-xs break-all",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
