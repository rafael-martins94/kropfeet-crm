import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { IconCart, IconChevronRight } from "../../components/Icons";
import { cn } from "../../utils/cn";

const regioes = [
  {
    key: "brasil" as const,
    titulo: "Brasil",
    descricao: "Pedidos do mercado brasileiro (BRL).",
    to: "/vendas/brasil",
    accent: "brand",
  },
  {
    key: "europa" as const,
    titulo: "Europa",
    descricao: "Pedidos do mercado europeu (EUR).",
    to: "/vendas/europa",
    accent: "info",
  },
] as const;

export default function VendasHubPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Ordens de venda"
        breadcrumbs={[{ label: "Comercial" }, { label: "Ordens de venda" }]}
      />

      <p className="mb-6 max-w-2xl text-sm text-ink-soft">
        Escolha a região para ver, criar e gerenciar as ordens de venda.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {regioes.map((regiao) => (
          <Link
            key={regiao.key}
            to={regiao.to}
            className={cn(
              "group relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition",
              "hover:border-brand-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  regiao.accent === "brand"
                    ? "bg-brand-50 text-brand-700"
                    : "bg-sky-50 text-sky-700",
                )}
              >
                <IconCart width={22} height={22} />
              </div>
              <IconChevronRight
                width={18}
                height={18}
                className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-brand-600"
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-ink">{regiao.titulo}</h2>
              <p className="mt-1 text-sm text-ink-soft">{regiao.descricao}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
