import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { marcasService } from "../../services/marcas";

export default function MarcaFormPage() {
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
    marcasService
      .obter(id)
      .then((m) => {
        if (m) setNome(m.nome);
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
        await marcasService.atualizar(id, { nome: nome.trim() });
      } else {
        const criada = await marcasService.criar({ nome: nome.trim() });
        navigate(`/marcas/${criada.id}`, { replace: true });
        return;
      }
      navigate("/marcas");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={edicao ? "Editar marca" : "Nova marca"}
        breadcrumbs={[{ label: "Catálogo" }, { label: "Marcas", to: "/marcas" }, { label: edicao ? "Editar" : "Nova" }]}
        backTo="/marcas"
      />

      <SectionCard>
        {loadingInicial ? (
          <div className="text-sm text-ink-soft">Carregando…</div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
            <FormInput
              label="Nome da marca"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Nike, Adidas, New Balance…"
              autoFocus
            />

            {erro ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <SecondaryButton type="button" onClick={() => navigate("/marcas")}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" loading={salvando}>
                {edicao ? "Salvar alterações" : "Criar marca"}
              </PrimaryButton>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
