import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormCheckbox, FormInput, FormSelect } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SectionCard } from "../../components/SectionCard";
import { LoadingState } from "../../components/LoadingState";
import { usuariosService, type CriarUsuarioInput } from "../../services/usuarios";
import { useAuth } from "../../contexts/AuthContext";
import type { PapelUsuario, PerfilUsuario } from "../../types/entities";

const OPCOES_PAPEL = [
  { value: "operador", label: "Operador (acesso padrão)" },
  { value: "admin", label: "Administrador (gerencia usuários)" },
];

export default function UsuarioFormPage() {
  const { id } = useParams<{ id: string }>();
  const modoEdicao = Boolean(id);
  const navigate = useNavigate();
  const { user: usuarioAtual, recarregarPerfil } = useAuth();

  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [perfilOriginal, setPerfilOriginal] = useState<PerfilUsuario | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelUsuario>("operador");
  const [ativo, setAtivo] = useState(true);
  const [modoCriacao, setModoCriacao] = useState<CriarUsuarioInput["modo"]>(
    "convite",
  );
  const [senha, setSenha] = useState("");

  useEffect(() => {
    if (!modoEdicao || !id) return;
    let cancelled = false;
    setCarregando(true);
    usuariosService
      .obter(id)
      .then((u) => {
        if (cancelled) return;
        setPerfilOriginal(u);
        setNome(u.nome);
        setEmail(u.email);
        setPapel(u.papel);
        setAtivo(u.ativo);
      })
      .catch((e) => {
        if (cancelled) return;
        setErro(e instanceof Error ? e.message : "Falha ao carregar usuário.");
      })
      .finally(() => !cancelled && setCarregando(false));
    return () => {
      cancelled = true;
    };
  }, [modoEdicao, id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      if (modoEdicao && id) {
        await usuariosService.atualizar(id, {
          nome: nome.trim(),
          papel,
          ativo,
        });
        if (id === usuarioAtual?.id) {
          await recarregarPerfil();
        }
        navigate("/usuarios");
      } else {
        await usuariosService.criar({
          nome,
          email,
          papel,
          modo: modoCriacao,
          senha: modoCriacao === "senha" ? senha : undefined,
        });
        navigate("/usuarios");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageHeader
          title={modoEdicao ? "Editar usuário" : "Novo usuário"}
          breadcrumbs={[
            { label: "Sistema" },
            { label: "Usuários", to: "/usuarios" },
            { label: modoEdicao ? "Editar" : "Novo" },
          ]}
          backTo="/usuarios"
        />
        <SectionCard>
          <LoadingState />
        </SectionCard>
      </div>
    );
  }

  const ehProprio = perfilOriginal?.id === usuarioAtual?.id;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader
        title={modoEdicao ? `Editar ${perfilOriginal?.nome ?? "usuário"}` : "Novo usuário"}
        breadcrumbs={[
          { label: "Sistema" },
          { label: "Usuários", to: "/usuarios" },
          { label: modoEdicao ? "Editar" : "Novo" },
        ]}
        backTo="/usuarios"
      />

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
        <SectionCard title="Dados básicos">
          <div className="space-y-4">
            <FormInput
              label="Nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Rafael Martins"
            />
            <FormInput
              label="E-mail"
              type="email"
              required
              disabled={modoEdicao}
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="pessoa@kropfeet.com"
              hint={
                modoEdicao
                  ? "O e-mail de autenticação não pode ser alterado por aqui."
                  : "Será usado para login e envio dos e-mails do sistema."
              }
            />
            <FormSelect
              label="Papel"
              required
              value={papel}
              onChange={(e) => setPapel(e.target.value as PapelUsuario)}
              options={OPCOES_PAPEL}
            />
          </div>
        </SectionCard>

        {modoEdicao ? (
          <SectionCard title="Status">
            <FormCheckbox
              label="Usuário ativo"
              description="Usuários inativos não conseguem mais acessar o CRM."
              checked={ativo}
              disabled={ehProprio}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            {ehProprio ? (
              <p className="mt-2 text-xs text-ink-soft">
                Você não pode desativar o próprio perfil.
              </p>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard title="Definição de senha">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition hover:bg-surface-subtle has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                  <input
                    type="radio"
                    name="modo"
                    value="convite"
                    className="mt-0.5 h-4 w-4 text-brand-600"
                    checked={modoCriacao === "convite"}
                    onChange={() => setModoCriacao("convite")}
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-ink">
                      Enviar convite por e-mail
                    </span>
                    <span className="block text-xs text-ink-soft">
                      O usuário recebe um link de redefinição de senha e define a própria senha.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition hover:bg-surface-subtle has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                  <input
                    type="radio"
                    name="modo"
                    value="senha"
                    className="mt-0.5 h-4 w-4 text-brand-600"
                    checked={modoCriacao === "senha"}
                    onChange={() => setModoCriacao("senha")}
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-ink">
                      Definir senha inicial agora
                    </span>
                    <span className="block text-xs text-ink-soft">
                      Você digita uma senha temporária e informa ao usuário.
                    </span>
                  </span>
                </label>
              </div>

              {modoCriacao === "senha" ? (
                <FormInput
                  label="Senha inicial"
                  type="password"
                  required
                  minLength={8}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  hint="Peça para o usuário alterar no primeiro acesso."
                />
              ) : null}
            </div>
          </SectionCard>
        )}

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/usuarios")}
            className="btn-ghost"
            disabled={salvando}
          >
            Cancelar
          </button>
          <PrimaryButton type="submit" loading={salvando}>
            {modoEdicao ? "Salvar alterações" : "Criar usuário"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
