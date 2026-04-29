import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout";
import { FormInput, FormCheckbox } from "../components/FormField";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { entrar, recuperarSenha } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
    ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    setLoading(true);
    try {
      await entrar(email, senha);
      navigate(destino, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível entrar.";
      setErro(
        msg.includes("Invalid login credentials")
          ? "E-mail ou senha inválidos."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async () => {
    setErro(null);
    setMensagem(null);
    if (!email.trim()) {
      setErro("Informe seu e-mail para recuperar a senha.");
      return;
    }
    try {
      await recuperarSenha(email);
      setMensagem("Se este e-mail estiver cadastrado, um link foi enviado.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao solicitar recuperação.");
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-2xl bg-white p-7 shadow-elevated ring-1 ring-white/10 sm:p-9">
        <div className="mb-7">
          <div className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-accent-600">
            Acesso
          </div>
          <h3 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-brand-800">
            Entrar na plataforma
          </h3>
          <p className="mt-1.5 text-sm text-ink-soft">
            Acesse sua conta para administrar o catálogo, estoque e vendas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@kropfeet.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <FormInput
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <div className="flex items-center justify-between gap-3">
            <FormCheckbox
              label="Lembrar acesso"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
            />
            <button
              type="button"
              onClick={handleRecuperar}
              className="text-xs font-medium text-brand-600 underline-offset-4 transition hover:text-brand-700 hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erro}
            </div>
          ) : null}
          {mensagem ? (
            <div className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-700">
              {mensagem}
            </div>
          ) : null}

          <PrimaryButton type="submit" loading={loading} className="w-full">
            Entrar
          </PrimaryButton>
        </form>

        <div className="mt-7 border-t border-line pt-5 text-center text-[0.68rem] uppercase tracking-[0.22em] text-ink-faint">
          Acesso restrito · KropFeet Sneakers
        </div>
      </div>
    </AuthLayout>
  );
}
