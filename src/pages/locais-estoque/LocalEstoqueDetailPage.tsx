import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconTrash } from "../../components/Icons";
import { locaisEstoqueService } from "../../services/locais-estoque";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora } from "../../utils/format";

export default function LocalEstoqueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useAsync(
    () => (id ? locaisEstoqueService.obter(id) : Promise.resolve(null)),
    [id],
  );

  const handleDelete = async () => {
    if (!id || !data) return;
    if (!window.confirm(`Excluir local "${data.nome}"?`)) return;
    try {
      await locaisEstoqueService.deletar(id);
      navigate("/locais-estoque");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={data?.nome ?? "Local"}
        breadcrumbs={[
          { label: "Operação" },
          { label: "Locais de estoque", to: "/locais-estoque" },
          { label: data?.nome ?? "…" },
        ]}
        backTo="/locais-estoque"
        actions={
          data ? (
            <>
              <SecondaryButton icon={<IconEdit width={16} height={16} />} onClick={() => navigate(`/locais-estoque/${data.id}/editar`)}>
                Editar
              </SecondaryButton>
              <DangerButton icon={<IconTrash width={16} height={16} />} onClick={handleDelete}>
                Excluir
              </DangerButton>
            </>
          ) : null
        }
      />
      {loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !data ? (
        <SectionCard><div className="text-sm text-ink-soft">Local não encontrado.</div></SectionCard>
      ) : (
        <SectionCard title="Informações">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código" value={data.codigo} mono />
            <Field label="Nome" value={data.nome} />
            <Field label="Região" value={<StatusBadge value={data.tipo_regiao} />} />
            <Field label="País" value={data.pais ?? "—"} />
            <Field label="Status" value={<StatusBadge value={data.ativo ? "ativo" : "inativo"} />} />
            <Field label="Criado em" value={formatarDataHora(data.criado_em)} />
            <Field label="ID" value={data.id} mono />
          </dl>
        </SectionCard>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
