import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import type { PerfilUsuario } from "../types/entities";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  perfil: PerfilUsuario | null;
  loading: boolean;
  entrar: (email: string, senha: string) => Promise<PerfilUsuario | null>;
  sair: () => Promise<void>;
  recuperarSenha: (email: string, destino?: string) => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function buscarPerfil(uid: string): Promise<PerfilUsuario | null> {
  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{
              data: PerfilUsuario | null;
              error: unknown;
            }>;
          };
        };
      };
    }
  )
    .from("perfis_usuario")
    .select("*")
    .eq("id", uid)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * Último perfil carregado, guardado no navegador só para a tela abrir sem esperar a rede.
 * O servidor continua decidindo o acesso (RLS); o perfil é revalidado logo em seguida.
 */
const CHAVE_PERFIL = "kropfeet.perfil";

function lerPerfilGuardado(uid: string): PerfilUsuario | null {
  try {
    const bruto = localStorage.getItem(CHAVE_PERFIL);
    const guardado = bruto ? (JSON.parse(bruto) as PerfilUsuario) : null;
    return guardado?.id === uid ? guardado : null;
  } catch {
    return null;
  }
}

function guardarPerfil(perfil: PerfilUsuario | null) {
  try {
    if (perfil) localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil));
    else localStorage.removeItem(CHAVE_PERFIL);
  } catch {
    /* navegador sem armazenamento: segue sem guardar */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  // Usuário cujo perfil já foi pedido: renovação de token não busca o perfil de novo.
  const uidCarregado = useRef<string | null>(null);

  useEffect(() => {
    let ativo = true;

    const carregarPerfil = async (uid: string, comPerfilGuardado: boolean) => {
      const p = await buscarPerfil(uid);
      if (!ativo || uidCarregado.current !== uid) return;
      setPerfil(p);
      guardarPerfil(p);
      if (!comPerfilGuardado) setLoading(false);
    };

    // onAuthStateChange já entrega a sessão inicial (INITIAL_SESSION); não há getSession à parte.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      if (!ativo) return;
      setSession(novaSessao);
      setUser(novaSessao?.user ?? null);

      const uid = novaSessao?.user?.id ?? null;
      if (!uid) {
        uidCarregado.current = null;
        setPerfil(null);
        guardarPerfil(null);
        setLoading(false);
        return;
      }
      if (uidCarregado.current === uid) return;
      uidCarregado.current = uid;

      const guardado = lerPerfilGuardado(uid);
      if (guardado) {
        setPerfil(guardado);
        setLoading(false);
      }
      // Fora do callback: consultar o Supabase aqui dentro espera a própria sessão e trava.
      setTimeout(() => void carregarPerfil(uid, Boolean(guardado)), 0);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const recarregarPerfil = useCallback(async () => {
    if (!user?.id) return;
    const p = await buscarPerfil(user.id);
    setPerfil(p);
    guardarPerfil(p);
  }, [user?.id]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) throw error;

    const uid = data.session?.user.id;
    if (!uid) return null;
    const p = await buscarPerfil(uid);
    if (p && p.ativo === false) {
      await supabase.auth.signOut();
      throw new Error(
        "Seu acesso está desativado. Fale com um administrador.",
      );
    }
    uidCarregado.current = uid;
    setPerfil(p);
    guardarPerfil(p);
    return p;
  }, []);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const recuperarSenha = useCallback(async (email: string, destino = "/login") => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${destino}`,
    });
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      perfil,
      loading,
      entrar,
      sair,
      recuperarSenha,
      recarregarPerfil,
    }),
    [user, session, perfil, loading, entrar, sair, recuperarSenha, recarregarPerfil],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser utilizado dentro de <AuthProvider>");
  }
  return ctx;
}
