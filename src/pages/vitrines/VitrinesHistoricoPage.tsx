import { Link, useSearchParams } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pagination } from "../../components/Pagination";
import { SearchInput } from "../../components/SearchInput";
import { SectionCard } from "../../components/SectionCard";
import { LinkPdfVitrine, VitrineStatusBadge } from "../../components/vitrines/VitrineShared";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { vitrinesService, type VitrineResumo } from "../../services/vitrines";
import { formatarData } from "../../utils/format";
import { readIntParam, useReplaceSearchParams, writeIntParam, writeParam } from "../../utils/listUrlParams";
import { useEffect, useState } from "react";

export default function VitrinesHistoricoPage() {
  const [searchParams] = useSearchParams();
  const patchParams = useReplaceSearchParams();
  const page = readIntParam(searchParams, "page", 1);
  const qUrl = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(qUrl);
  const searchDebounced = useDebounce(search, 400);

  useEffect(() => setSearch(qUrl), [qUrl]);

  const listagem = useAsync(
    () =>
      vitrinesService.listar({
        page,
        pageSize: 20,
        search: searchDebounced,
        status: ["publicada", "encerrada"],
      }),
    [page, searchDebounced],
  );

  const setPage = (value: number) => patchParams((next) => writeIntParam(next, "page", value));
  const setBusca = (value: string) => {
    setSearch(value);
    patchParams((next) => {
      writeParam(next, "q", value.trim() || null);
      next.delete("page");
    });
  };

  const columns: Column<VitrineResumo>[] = [
    {
      key: "titulo",
      header: "Vitrine",
      render: (v) => (
        <div>
          <Link to={`/vitrines/${v.id}`} className="font-medium text-ink hover:text-brand-700">
            {v.titulo}
          </Link>
          <p className="text-xs text-ink-soft">{v.nomeUsuario ?? "—"}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (v) => <VitrineStatusBadge status={v.status} /> },
    {
      key: "periodo",
      header: "Período",
      render: (v) => (
        <span className="text-sm text-ink-muted">
          {formatarData(v.publicado_em ?? v.criado_em)}
          {v.encerrado_em ? ` até ${formatarData(v.encerrado_em)}` : ""}
        </span>
      ),
    },
    { key: "itens", header: "Itens", render: (v) => <span>{v.totalItens ?? 0}</span> },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      render: (v) => (
        <div className="flex justify-end gap-2">
          <LinkPdfVitrine id={v.id} />
          <Link
            to={`/vitrines/${v.id}`}
            className="inline-flex rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted hover:border-brand-400 hover:text-brand-700"
          >
            Detalhes
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title="Histórico de vitrines"
        breadcrumbs={[{ label: "Operação" }, { label: "Vitrines", to: "/vitrines" }, { label: "Histórico" }]}
        backTo="/vitrines"
      />
      <SectionCard noPadding>
        <div className="border-b border-line p-4">
          <SearchInput
            value={search}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por título da vitrine…"
            wrapperClassName="max-w-md"
          />
        </div>
        <DataTable
          columns={columns}
          rows={listagem.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={listagem.loading}
          emptyTitle="Nenhuma vitrine encontrada"
        />
        <Pagination
          page={page}
          pageSize={listagem.data?.pageSize ?? 20}
          total={listagem.data?.total ?? 0}
          onPageChange={setPage}
        />
      </SectionCard>
    </div>
  );
}
