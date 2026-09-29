import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { podeAcessarCatalogo, ROTA_CATALOGO, ROTA_LOGIN_CATALOGO } from "../routes/ProtectedRoute";

export default function CatalogoLoginPage() {
  const { perfil, loading: authLoading, entrar, sair, recuperarSenha } = useAuth();
  const navigate = useNavigate();
  const envioEmAndamento = useRef(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || envioEmAndamento.current || !podeAcessarCatalogo(perfil)) return;
    navigate(ROTA_CATALOGO, { replace: true });
  }, [authLoading, perfil, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    envioEmAndamento.current = true;
    try {
      const perfilEntrada = await entrar(email, senha);
      if (!podeAcessarCatalogo(perfilEntrada)) {
        await sair();
        setErro("Esta entrada é da equipe: vendedor, operador ou administrador.");
        return;
      }
      navigate(ROTA_CATALOGO, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível entrar.";
      setErro(
        msg.includes("Invalid login credentials")
          ? "E-mail ou senha inválidos."
          : msg,
      );
    } finally {
      envioEmAndamento.current = false;
      setEnviando(false);
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
      await recuperarSenha(email, ROTA_LOGIN_CATALOGO);
      setMensagem("Se este e-mail estiver cadastrado, um link foi enviado.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao solicitar recuperação.");
    }
  };

  if (authLoading || (podeAcessarCatalogo(perfil) && !erro)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505] text-sm font-bold text-[#d7b56d]">
        Verificando sessão…
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <img
          src="/kropcafe-logo-white-glow.png?v=2"
          alt="KropCafé"
          className="mx-auto mb-8 h-auto w-44 object-contain sm:w-52"
          draggable={false}
        />
        <form
          onSubmit={handleSubmit}
          className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d7b56d]">
            Catálogo
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Entrar</h1>
          <p className="mt-2 text-sm text-white/60">
            Acesso de vendedores, operadores e administradores.
          </p>

          <label className="mt-6 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b56d]">
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-base font-semibold text-white outline-none transition focus:border-[#d7b56d] focus:ring-4 focus:ring-[#d7b56d]/20"
            />
          </label>

          <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b56d]">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-base font-semibold text-white outline-none transition focus:border-[#d7b56d] focus:ring-4 focus:ring-[#d7b56d]/20"
            />
          </label>

          <div className="mt-3 text-right">
            <button
              type="button"
              onClick={handleRecuperar}
              className="text-xs font-bold text-white/55 underline-offset-4 transition hover:text-[#d7b56d] hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>

          {erro ? (
            <p className="mt-4 rounded-xl border border-[#e07a5f]/40 bg-[#e07a5f]/10 px-3 py-2 text-sm text-[#f6c7b6]">
              {erro}
            </p>
          ) : null}
          {mensagem ? (
            <p className="mt-4 rounded-xl border border-[#146c43]/40 bg-[#146c43]/15 px-3 py-2 text-sm text-white/80">
              {mensagem}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 min-h-12 w-full rounded-full bg-[#d7b56d] px-4 text-sm font-black text-stone-950 transition hover:bg-[#e2c688] disabled:opacity-60"
          >
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
