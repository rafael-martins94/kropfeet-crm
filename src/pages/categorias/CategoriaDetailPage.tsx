import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { IconEdit, IconTrash } from "../../components/Icons";
import { categoriasService } from "../../services/categorias";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora } from "../../utils/format";

export default function CategoriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(
    () => (id ? categoriasService.obter(id) : Promise.resolve(null)),
    [id],
  );

  const handleDelete = async () => {
    if (!id || !data) return;
    if (!window.confirm(`Excluir a categoria "${data.nome}"?`)) return;
    try {
      await categoriasService.deletar(id);
      navigate("/categorias");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div>
      <PageHeader
        title={data?.nome ?? "Categoria"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Categorias", to: "/categorias" },
          { label: data?.nome ?? "…" },
        ]}
        backTo="/categorias"
        actions={
          data ? (
            <>
              <SecondaryButton
                icon={<IconEdit width={16} height={16} />}
                onClick={() => navigate(`/categorias/${data.id}/editar`)}
              >
                Editar
              </SecondaryButton>
              <DangerButton
                icon={<IconTrash width={16} height={16} />}
                onClick={handleDelete}
              >
                Excluir
              </DangerButton>
            </>
          ) : null
        }
      />
      {loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : error ? (
        <SectionCard><div className="text-sm text-red-700">Erro: {error.message}</div></SectionCard>
      ) : !data ? (
        <SectionCard>
          <div className="text-sm text-ink-soft">Categoria não encontrada.</div>
          <div className="mt-4">
            <PrimaryButton onClick={() => navigate("/categorias")}>Voltar</PrimaryButton>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Informações">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Nome" value={data.nome} />
            <Field label="ID" value={data.id} mono />
            <Field label="Criado em" value={formatarDataHora(data.criado_em)} />
          </dl>
        </SectionCard>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
