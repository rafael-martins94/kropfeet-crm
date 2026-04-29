import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { DangerButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { StatusBadge } from "../../components/StatusBadge";
import { IconEdit, IconImage, IconTrash } from "../../components/Icons";
import { EmptyState } from "../../components/EmptyState";
import { modelosProdutoService } from "../../services/modelos-produto";
import { marcasService } from "../../services/marcas";
import { categoriasService } from "../../services/categorias";
import { useAsync } from "../../hooks/useAsync";
import { formatarDataHora, traduzirEnum } from "../../utils/format";

export default function ModeloDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const modelo = useAsync(
    () => (id ? modelosProdutoService.obter(id) : Promise.resolve(null)),
    [id],
  );
  const imagens = useAsync(
    () => (id ? modelosProdutoService.obterImagens(id) : Promise.resolve([])),
    [id],
  );
  const marca = useAsync(
    () =>
      modelo.data?.id_marca
        ? marcasService.obter(modelo.data.id_marca)
        : Promise.resolve(null),
    [modelo.data?.id_marca],
  );
  const categoria = useAsync(
    () =>
      modelo.data?.id_categoria
        ? categoriasService.obter(modelo.data.id_categoria)
        : Promise.resolve(null),
    [modelo.data?.id_categoria],
  );

  const handleDelete = async () => {
    if (!id || !modelo.data) return;
    if (!window.confirm(`Excluir modelo "${modelo.data.nome_modelo}"?`)) return;
    try {
      await modelosProdutoService.deletar(id);
      navigate("/modelos-produto");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={modelo.data?.nome_modelo ?? "Modelo"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Modelos", to: "/modelos-produto" },
          { label: modelo.data?.nome_modelo ?? "…" },
        ]}
        backTo="/modelos-produto"
        actions={
          modelo.data ? (
            <>
              <SecondaryButton
                icon={<IconEdit width={16} height={16} />}
                onClick={() => navigate(`/modelos-produto/${modelo.data!.id}/editar`)}
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

      {modelo.loading ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : !modelo.data ? (
        <SectionCard><div className="text-sm text-ink-soft">Modelo não encontrado.</div></SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard
              title="Identificação"
              actions={<StatusBadge value={modelo.data.ativo ? "ativo" : "inativo"} />}
            >
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Nome" value={modelo.data.nome_modelo} />
                <Field label="Slug" value={modelo.data.slug} mono />
                <Field label="Marca" value={marca.data?.nome ?? "—"} />
                <Field label="Categoria" value={categoria.data?.nome ?? "—"} />
                <Field label="Código de referência" value={modelo.data.codigo_referencia ?? "—"} mono />
                <Field label="Código do fabricante" value={modelo.data.codigo_fabricante ?? "—"} mono />
                <Field label="Cor" value={modelo.data.cor ?? "—"} />
                <Field label="Gênero" value={modelo.data.genero ?? "—"} />
                <Field label="Origem do cadastro" value={<StatusBadge value={modelo.data.origem_cadastro} />} />
                <Field label="ID Tiny (pai)" value={modelo.data.id_tiny_pai ?? "—"} mono />
              </dl>
            </SectionCard>

            {modelo.data.descricao ? (
              <SectionCard title="Descrição">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {modelo.data.descricao}
                </p>
              </SectionCard>
            ) : null}

            <SectionCard title="Auditoria">
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Criado em" value={formatarDataHora(modelo.data.criado_em)} />
                <Field label="Atualizado em" value={formatarDataHora(modelo.data.atualizado_em)} />
                <Field label="ID interno" value={modelo.data.id} mono />
                <Field label="Origem" value={traduzirEnum(modelo.data.origem_cadastro)} />
              </dl>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Imagens" noPadding>
              {imagens.loading ? (
                <div className="p-5 text-sm text-ink-soft">Carregando imagens…</div>
              ) : (imagens.data ?? []).length === 0 ? (
                <EmptyState
                  icon={<IconImage />}
                  title="Sem imagens"
                  description="Este modelo ainda não possui imagens cadastradas."
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 p-3">
                  {(imagens.data ?? []).map((img) => {
                    const src = img.url_origem ?? img.caminho_arquivo ?? "";
                    return (
                      <div
                        key={img.id}
                        className="group relative overflow-hidden rounded-lg border border-line bg-surface-subtle aspect-square"
                      >
                        {src ? (
                          <img
                            src={src}
                            alt={modelo.data!.nome_modelo}
                            loading="lazy"
                            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-ink-faint">
                            <IconImage />
                          </div>
                        )}
                        {img.imagem_principal ? (
                          <span className="absolute left-2 top-2 rounded-full bg-accent-300/90 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-brand-700">
                            Principal
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
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
      <dd className={`mt-1 text-sm text-ink ${mono ? "font-numeric tabular-nums text-xs break-all" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
