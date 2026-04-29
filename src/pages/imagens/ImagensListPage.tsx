import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { ScrollableListShell } from "../../components/ScrollableListShell";
import { SectionCard } from "../../components/SectionCard";
import { imagensService } from "../../services/imagens";
import { useAsync } from "../../hooks/useAsync";

export default function ImagensListPage() {
  const [page, setPage] = useState(1);
  const [apenasPrincipais, setApenasPrincipais] = useState(true);
  const { data, loading, error } = useAsync(
    () => imagensService.listar({ page, pageSize: 24, apenasPrincipais }),
    [page, apenasPrincipais],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Galeria de imagens"
        breadcrumbs={[{ label: "Catálogo" }, { label: "Imagens" }]}
      />

      <SectionCard
        title="Imagens"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={apenasPrincipais}
              onChange={(e) => {
                setApenasPrincipais(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
            />
            Apenas principais
          </label>
        }
      >
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="text-sm text-red-700">Erro: {error.message}</div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="Nenhuma imagem encontrada" />
        ) : (
          <ScrollableListShell
            body={
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {data.data.map((img) => {
                  const src = img.url_origem ?? img.caminho_arquivo ?? "";
                  return (
                    <Link
                      key={img.id}
                      to={img.modelo ? `/modelos-produto/${img.modelo.id}` : "#"}
                      className="group relative block aspect-square overflow-hidden rounded-xl border border-line bg-surface-alt"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={img.modelo?.nome_modelo ?? "Imagem do modelo"}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-ink-faint">
                          sem imagem
                        </div>
                      )}
                      {img.imagem_principal ? (
                        <span className="absolute left-2 top-2 rounded-full bg-brand-700/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white shadow-sm">
                          Principal
                        </span>
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <p className="line-clamp-2 text-xs font-medium text-white">
                          {img.modelo?.nome_modelo ?? "—"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            }
            footer={<Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
          />
        )}
      </SectionCard>
    </div>
  );
}
