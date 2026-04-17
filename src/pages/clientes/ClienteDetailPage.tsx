import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { IconEdit, IconTrash } from "../../components/Icons";
import { clientesService } from "../../services/clientes";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora } from "../../utils/format";

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useAsync(
    () => (id ? clientesService.obter(id) : Promise.resolve(null)),
    [id],
  );

  const handleDelete = async () => {
    if (!id || !data) return;
    if (!window.confirm(`Excluir "${data.nome}"?`)) return;
    try {
      await clientesService.deletar(id);
      navigate("/clientes");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div>
      <PageHeader
        title={data?.nome ?? "Cliente"}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Clientes", to: "/clientes" },
          { label: data?.nome ?? "…" },
        ]}
        backTo="/clientes"
        actions={
          data ? (
            <>
              <SecondaryButton icon={<IconEdit width={16} height={16} />} onClick={() => navigate(`/clientes/${data.id}/editar`)}>
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
        <SectionCard><div className="text-sm text-ink-soft">Cliente não encontrado.</div></SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard title="Dados do cliente">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <F label="Nome" value={data.nome} />
              <F label="E-mail" value={data.email ?? "—"} />
              <F label="Telefone" value={data.telefone ?? "—"} />
              <F label="Instagram" value={data.instagram ?? "—"} />
              <F label="País" value={data.pais ?? "—"} />
            </dl>
          </SectionCard>

          {data.observacoes ? (
            <SectionCard title="Observações">
              <p className="whitespace-pre-wrap text-sm text-ink">{data.observacoes}</p>
            </SectionCard>
          ) : null}

          <SectionCard title="Auditoria">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <F label="Criado em" value={formatarDataHora(data.criado_em)} />
              <F label="Atualizado em" value={formatarDataHora(data.atualizado_em)} />
              <F label="ID interno" value={data.id} mono />
            </dl>
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
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
