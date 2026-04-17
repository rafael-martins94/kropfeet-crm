import { createClient } from "@supabase/supabase-js";
import { env } from "../lib/env";
import { supabase } from "../lib/supabase";
import type {
  PaginatedResult,
  PaginationParams,
  PapelUsuario,
  PerfilUsuario,
  PerfilUsuarioUpdate,
} from "../types/entities";

const sb = supabase as unknown as {
  from: (table: string) => any;
};

function gerarSenhaAleatoria(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let out = "";
  const buf = new Uint32Array(24);
  crypto.getRandomValues(buf);
  for (const v of buf) out += chars[v % chars.length];
  return out;
}

export interface CriarUsuarioInput {
  nome: string;
  email: string;
  papel: PapelUsuario;
  modo: "senha" | "convite";
  senha?: string;
}

export const usuariosService = {
  async listar(
    params?: PaginationParams,
  ): Promise<PaginatedResult<PerfilUsuario>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 25;
    const search = params?.search?.trim() ?? "";

    let query = sb
      .from("perfis_usuario")
      .select("*", { count: "exact" });

    if (search) {
      const pattern = `%${search}%`;
      query = query.or(`nome.ilike.${pattern},email.ilike.${pattern}`);
    }

    query = query
      .order(params?.orderBy ?? "criado_em", {
        ascending: params?.ascending ?? false,
      })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      data: (data ?? []) as PerfilUsuario[],
      total: (count as number | null) ?? 0,
      page,
      pageSize,
    };
  },

  async obter(id: string): Promise<PerfilUsuario> {
    const { data, error } = await sb
      .from("perfis_usuario")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as PerfilUsuario;
  },

  async obterPerfilAtual(): Promise<PerfilUsuario | null> {
    const { data: sessionData } = await supabase.auth.getUser();
    const uid = sessionData.user?.id;
    if (!uid) return null;
    const { data, error } = await sb
      .from("perfis_usuario")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw error;
    return (data as PerfilUsuario | null) ?? null;
  },

  async atualizar(
    id: string,
    patch: PerfilUsuarioUpdate,
  ): Promise<void> {
    const { error } = await sb
      .from("perfis_usuario")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  },

  async definirAtivo(id: string, ativo: boolean): Promise<void> {
    await usuariosService.atualizar(id, { ativo });
  },

  async excluirPerfil(id: string): Promise<void> {
    const { error } = await sb.from("perfis_usuario").delete().eq("id", id);
    if (error) throw error;
  },

  /**
   * Cria um novo usuário via supabase.auth.signUp usando um client isolado
   * (sem persistir sessão), de modo a NÃO afetar a sessão do admin atual.
   * O trigger handle_novo_usuario() em auth.users cria o registro em
   * perfis_usuario automaticamente com o papel informado em user_metadata.
   */
  async criar(input: CriarUsuarioInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const nome = input.nome.trim();
    if (!email || !nome) throw new Error("Informe nome e e-mail.");

    const senha =
      input.modo === "senha"
        ? (input.senha ?? "").trim()
        : gerarSenhaAleatoria();

    if (input.modo === "senha" && senha.length < 8) {
      throw new Error("A senha deve ter pelo menos 8 caracteres.");
    }

    const tempClient = createClient(env.supabase.url, env.supabase.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `kropfeet.signup.${Date.now()}`,
      },
    });

    const { error } = await tempClient.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome,
          papel: input.papel,
        },
      },
    });

    if (error) throw error;

    if (input.modo === "convite") {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
      if (resetError) {
        console.warn(
          "Usuário criado, mas falhou ao enviar e-mail de definição de senha:",
          resetError.message,
        );
      }
    }
  },

  async enviarResetSenha(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  },
};
