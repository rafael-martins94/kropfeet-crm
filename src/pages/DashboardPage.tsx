import { Link } from "react-router-dom";
import { HeroSection } from "../components/HeroSection";
import { PrimaryButton, SecondaryButton } from "../components/PrimaryButton";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { InlineLoader } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import {
  IconBox,
  IconCart,
  IconFolder,
  IconImage,
  IconPin,
  IconShoe,
  IconTag,
  IconTruck,
  IconUser,
} from "../components/Icons";
import { dashboardService } from "../services/dashboard";
import { useAsync } from "../hooks/useAsync";
import { formatarDataHora, formatarNumero } from "../utils/format";

export default function DashboardPage() {
  const metricas = useAsync(() => dashboardService.carregarMetricas(), []);
  const ultimosModelos = useAsync(() => dashboardService.ultimosModelos(6), []);
  const ultimosItens = useAsync(() => dashboardService.ultimosItens(6), []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <HeroSection
        eyebrow="Visão geral"
        title="Bem-vindo à KropFeet."
        actions={
          <>
            <PrimaryButton
              type="button"
              className="!bg-white !text-brand-700 hover:!bg-accent-100"
              onClick={() => {
                window.location.href = "/modelos-produto";
              }}
            >
              Explorar catálogo
            </PrimaryButton>
            <SecondaryButton
              type="button"
              className="!bg-white/10 !text-white !border-white/25 hover:!bg-white/20 hover:!text-white"
              onClick={() => {
                window.location.href = "/itens-estoque";
              }}
            >
              Ver estoque
            </SecondaryButton>
          </>
        }
      />

      <div className="mb-6">
        {metricas.error ? (
          <div className="card p-5 text-sm text-red-700">
            Erro ao carregar métricas: {metricas.error.message}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Modelos cadastrados"
              value={formatarNumero(metricas.data?.totalModelos)}
              hint="Conceito de produto (nível pai)"
              icon={<IconShoe />}
              loading={metricas.loading}
            />
            <StatCard
              label="Itens em estoque"
              value={formatarNumero(metricas.data?.itensEmEstoque)}
              hint={`${formatarNumero(metricas.data?.totalItensEstoque)} pares no total`}
              icon={<IconBox />}
              tone="accent"
              loading={metricas.loading}
            />
            <StatCard
              label="Fornecedores"
              value={formatarNumero(metricas.data?.totalFornecedores)}
              hint={`${formatarNumero(metricas.data?.fornecedoresAtivos)} ativos`}
              icon={<IconTruck />}
              tone="neutral"
              loading={metricas.loading}
            />
            <StatCard
              label="Vendas registradas"
              value={formatarNumero(metricas.data?.totalVendas)}
              hint={`${formatarNumero(metricas.data?.totalClientes)} clientes`}
              icon={<IconCart />}
              loading={metricas.loading}
            />
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <MiniStat
          to="/marcas"
          label="Marcas"
          value={metricas.data?.totalMarcas}
          icon={<IconTag />}
          loading={metricas.loading}
        />
        <MiniStat
          to="/categorias"
          label="Categorias"
          value={metricas.data?.totalCategorias}
          icon={<IconFolder />}
          loading={metricas.loading}
        />
        <MiniStat
          to="/locais-estoque"
          label="Locais"
          value={metricas.data?.totalLocais}
          icon={<IconPin />}
          loading={metricas.loading}
        />
        <MiniStat
          to="/imagens"
          label="Imagens"
          value={metricas.data?.totalImagens}
          icon={<IconImage />}
          loading={metricas.loading}
        />
        <MiniStat
          to="/clientes"
          label="Clientes"
          value={metricas.data?.totalClientes}
          icon={<IconUser />}
          loading={metricas.loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Últimos modelos atualizados"
          actions={
            <Link
              to="/modelos-produto"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Ver todos →
            </Link>
          }
          noPadding
        >
          {ultimosModelos.loading ? (
            <div className="p-5">
              <InlineLoader />
            </div>
          ) : (ultimosModelos.data ?? []).length === 0 ? (
            <EmptyState title="Sem modelos" description="Nenhum modelo encontrado." />
          ) : (
            <ul className="divide-y divide-line">
              {(ultimosModelos.data ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/modelos-produto/${m.id}`}
                      className="block truncate text-sm font-medium text-ink hover:text-brand-700"
                    >
                      {m.nome_modelo}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                      <span className="truncate">{m.slug}</span>
                      {m.cor ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-line" />
                          <span className="truncate">{m.cor}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge value={m.ativo ? "ativo" : "inativo"} />
                    <span className="hidden text-xs text-ink-soft sm:inline">
                      {formatarDataHora(m.atualizado_em)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Últimos itens de estoque"
          actions={
            <Link
              to="/itens-estoque"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Ver todos →
            </Link>
          }
          noPadding
        >
          {ultimosItens.loading ? (
            <div className="p-5">
              <InlineLoader />
            </div>
          ) : (ultimosItens.data ?? []).length === 0 ? (
            <EmptyState title="Sem itens" description="Nenhum item encontrado." />
          ) : (
            <ul className="divide-y divide-line">
              {(ultimosItens.data ?? []).map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/itens-estoque/${it.id}`}
                      className="block truncate text-sm font-medium text-ink hover:text-brand-700"
                    >
                      {it.nome_completo}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-ink-soft">SKU {it.sku}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge value={it.status_item} />
                    <span className="hidden text-xs text-ink-soft sm:inline">
                      {formatarDataHora(it.atualizado_em)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function MiniStat({
  to,
  label,
  value,
  icon,
  loading,
}: {
  to: string;
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Link
      to={to}
      className="card card-hover flex items-center gap-3 p-4 transition hover:border-brand-200"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
          {label}
        </div>
        <div className="font-display text-xl font-semibold text-brand-700">
          {loading ? (
            <span className="skeleton inline-block h-5 w-12 rounded" />
          ) : (
            formatarNumero(value)
          )}
        </div>
      </div>
    </Link>
  );
}
