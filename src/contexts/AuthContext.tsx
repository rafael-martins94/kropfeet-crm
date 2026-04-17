import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  recuperarSenha: (email: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    const aplicarSessao = async (novaSessao: Session | null) => {
      if (!ativo) return;
      setSession(novaSessao);
      setUser(novaSessao?.user ?? null);
      if (novaSessao?.user?.id) {
        const p = await buscarPerfil(novaSessao.user.id);
        if (ativo) setPerfil(p);
      } else {
        setPerfil(null);
      }
      if (ativo) setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      void aplicarSessao(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      void aplicarSessao(novaSessao);
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
  }, [user?.id]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) throw error;

    const uid = data.session?.user.id;
    if (!uid) return;
    const p = await buscarPerfil(uid);
    if (p && p.ativo === false) {
      await supabase.auth.signOut();
      throw new Error(
        "Seu acesso está desativado. Fale com um administrador.",
      );
    }
  }, []);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const recuperarSenha = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
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
