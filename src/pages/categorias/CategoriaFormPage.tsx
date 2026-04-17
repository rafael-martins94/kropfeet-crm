import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { categoriasService } from "../../services/categorias";

export default function CategoriaFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    categoriasService
      .obter(id)
      .then((c) => {
        if (c) setNome(c.nome);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      if (id) {
        await categoriasService.atualizar(id, { nome: nome.trim() });
      } else {
        const c = await categoriasService.criar({ nome: nome.trim() });
        navigate(`/categorias/${c.id}`, { replace: true });
        return;
      }
      navigate("/categorias");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={edicao ? "Editar categoria" : "Nova categoria"}
        breadcrumbs={[
          { label: "Catálogo" },
          { label: "Categorias", to: "/categorias" },
          { label: edicao ? "Editar" : "Nova" },
        ]}
        backTo="/categorias"
      />
      <SectionCard>
        {loadingInicial ? (
          <div className="text-sm text-ink-soft">Carregando…</div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
            <FormInput
              label="Nome da categoria"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
            {erro ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <SecondaryButton type="button" onClick={() => navigate("/categorias")}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" loading={salvando}>
                {edicao ? "Salvar alterações" : "Criar categoria"}
              </PrimaryButton>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
