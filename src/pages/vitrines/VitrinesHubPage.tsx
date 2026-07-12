import { Link, useNavigate } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEye, IconPlus } from "../../components/Icons";
import { VitrineMeta, VitrineStatusBadge, LinkPdfVitrine } from "../../components/vitrines/VitrineShared";
import { useAuth } from "../../contexts/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { vitrinesService, type VitrineResumo } from "../../services/vitrines";
import { formatarData } from "../../utils/format";
import { mensagemErro } from "../../utils/errors";
import { useState } from "react";

export default function VitrinesHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [criando, setCriando] = useState(false);
  const atual = useAsync(() => vitrinesService.obterAtualComItens(), []);
  const rascunho = useAsync(() => vitrinesService.obterRascunho(), []);
  const historico = useAsync(
    () => vitrinesService.listar({ page: 1, pageSize: 8, status: ["publicada", "encerrada"] }),
    [],
  );

  const criarRascunho = async () => {
    if (!user?.id) return;
    setCriando(true);
    try {
      const vitrine = await vitrinesService.criarOuContinuarRascunho(user.id);
      navigate(`/vitrines/${vitrine.id}/editar`);
    } catch (error) {
      alert(mensagemErro(error));
    } finally {
      setCriando(false);
    }
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
    {
      key: "status",
      header: "Status",
      render: (v) => <VitrineStatusBadge status={v.status} />,
    },
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
    {
      key: "itens",
      header: "Itens",
      render: (v) => <span className="font-numeric text-sm text-ink-muted">{v.totalItens ?? 0}</span>,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      render: (v) => (
        <div className="flex justify-end gap-2">
          <LinkPdfVitrine id={v.id} />
          <Link
            to={`/vitrines/${v.id}`}
            className="inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-brand-400 hover:text-brand-700"
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
        title="Vitrines"
        breadcrumbs={[{ label: "Operação" }, { label: "Vitrines" }]}
        actions={
          <PrimaryButton icon={<IconPlus width={16} height={16} />} loading={criando} onClick={criarRascunho}>
            Nova vitrine
          </PrimaryButton>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.45fr)]">
        <SectionCard
          title="Vitrine atual"
          description="Consulta rápida dos 22 tênis atualmente expostos."
          actions={
            atual.data ? (
              <div className="flex gap-2">
                <SecondaryButton icon={<IconEye width={16} height={16} />} onClick={() => navigate("/vitrines/atual")}>
                  Abrir
                </SecondaryButton>
                <LinkPdfVitrine id={atual.data.id} />
              </div>
            ) : null
          }
        >
          {atual.loading ? (
            <p className="text-sm text-ink-soft">Carregando…</p>
          ) : atual.data ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{atual.data.titulo}</h2>
                <VitrineMeta vitrine={atual.data} />
              </div>
              {atual.data.itens.some((item) => item.estado_caixa === "vendida") ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Há caixas vazias na vitrine atual.{" "}
                  <Link to="/vitrines/atual" className="font-semibold underline">
                    Abrir e substituir
                  </Link>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Caixas" value={`${atual.data.itens.length}/22`} />
                <Kpi
                  label="Caixas vazias"
                  value={String(atual.data.itens.filter((item) => item.estado_caixa === "vendida").length)}
                />
                <Kpi label="Responsável" value={atual.data.nomeUsuario ?? "—"} />
                <Kpi label="Publicação" value={formatarData(atual.data.publicado_em)} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Nenhuma vitrine publicada ainda.</p>
          )}
          {atual.error ? <p className="mt-3 text-sm text-red-700">{atual.error.message}</p> : null}
        </SectionCard>

        <SectionCard title="Rascunho" description="Continue a vitrine em andamento sem alterar o estoque.">
          {rascunho.loading ? (
            <p className="text-sm text-ink-soft">Carregando…</p>
          ) : rascunho.data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{rascunho.data.titulo}</p>
                  <p className="text-xs text-ink-soft">Etapa: {rascunho.data.etapa.replace(/_/g, " ")}</p>
                </div>
                <StatusBadge value="rascunho" label="Rascunho" tom="aviso" />
              </div>
              <PrimaryButton className="w-full" onClick={() => navigate(`/vitrines/${rascunho.data!.id}/editar`)}>
                Continuar rascunho
              </PrimaryButton>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">Não há rascunho salvo.</p>
              <SecondaryButton className="w-full" onClick={criarRascunho}>
                Criar rascunho
              </SecondaryButton>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="mt-5"
        title="Histórico recente"
        description="Vitrines publicadas e encerradas permanecem salvas por snapshot."
        actions={
          <Link to="/vitrines/historico" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Ver histórico completo
          </Link>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          rows={historico.data?.data ?? []}
          rowKey={(v) => v.id}
          loading={historico.loading}
          emptyTitle="Nenhuma vitrine no histórico"
        />
      </SectionCard>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-muted/40 p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 truncate font-semibold text-ink">{value}</p>
    </div>
  );
}
