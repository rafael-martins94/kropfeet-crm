import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormInput, FormTextarea } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { clientesService } from "../../services/clientes";
import { limparParaBanco } from "../../utils/format";
import type { ClienteInsert } from "../../types/entities";

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  instagram: string;
  pais: string;
  observacoes: string;
};

const vazio: FormState = { nome: "", email: "", telefone: "", instagram: "", pais: "", observacoes: "" };

export default function ClienteFormPage() {
  const { id } = useParams<{ id: string }>();
  const edicao = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(vazio);
  const [loadingInicial, setLoadingInicial] = useState(edicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadingInicial(true);
    clientesService
      .obter(id)
      .then((c) => {
        if (!c) return;
        setForm({
          nome: c.nome ?? "",
          email: c.email ?? "",
          telefone: c.telefone ?? "",
          instagram: c.instagram ?? "",
          pais: c.pais ?? "",
          observacoes: c.observacoes ?? "",
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoadingInicial(false));
  }, [id]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = limparParaBanco(form) as unknown as ClienteInsert;
      if (id) {
        await clientesService.atualizar(id, payload);
      } else {
        const c = await clientesService.criar(payload);
        navigate(`/clientes/${c.id}`, { replace: true });
        return;
      }
      navigate("/clientes");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={edicao ? "Editar cliente" : "Novo cliente"}
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Clientes", to: "/clientes" },
          { label: edicao ? "Editar" : "Novo" },
        ]}
        backTo="/clientes"
      />

      {loadingInicial ? (
        <SectionCard><div className="text-sm text-ink-soft">Carregando…</div></SectionCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Dados do cliente">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="Nome"
                required
                value={form.nome}
                onChange={(e) => upd("nome", e.target.value)}
                wrapperClassName="sm:col-span-2"
              />
              <FormInput
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(e) => upd("email", e.target.value)}
              />
              <FormInput
                label="Telefone"
                value={form.telefone}
                onChange={(e) => upd("telefone", e.target.value)}
              />
              <FormInput
                label="Instagram"
                value={form.instagram}
                onChange={(e) => upd("instagram", e.target.value)}
                placeholder="@usuario"
              />
              <FormInput
                label="País"
                value={form.pais}
                onChange={(e) => upd("pais", e.target.value)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Observações">
            <FormTextarea
              label="Notas internas"
              rows={4}
              value={form.observacoes}
              onChange={(e) => upd("observacoes", e.target.value)}
            />
          </SectionCard>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <SecondaryButton type="button" onClick={() => navigate("/clientes")}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" loading={salvando}>
              {edicao ? "Salvar alterações" : "Criar cliente"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
