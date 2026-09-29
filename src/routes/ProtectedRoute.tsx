import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PageLoader } from "../components/LoadingState";
import type { PapelUsuario } from "../types/entities";

const PAPEIS_CATALOGO: PapelUsuario[] = ["admin", "operador", "vendedor"];

export function podeAcessarCatalogo(
  perfil: { papel: PapelUsuario; ativo: boolean } | null | undefined,
): boolean {
  return Boolean(perfil?.ativo && PAPEIS_CATALOGO.includes(perfil.papel));
}

export const ROTA_CATALOGO = "/catalogo-kropcafe";
export const ROTA_LOGIN_CATALOGO = "/catalogo-kropcafe/entrar";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader label="Verificando sessão…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function CatalogoRoute() {
  const { user, perfil, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505] text-sm font-bold text-[#d7b56d]">
        Verificando sessão…
      </div>
    );
  }

  if (!user || !podeAcessarCatalogo(perfil)) {
    return <Navigate to={ROTA_LOGIN_CATALOGO} replace />;
  }

  return <Outlet />;
}

export function CrmRoute() {
  const { perfil } = useAuth();

  if (perfil?.papel === "vendedor") {
    return <Navigate to={ROTA_CATALOGO} replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { loading } = useAuth();
  if (loading) return <PageLoader />;
  return <Outlet />;
}
