import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { IconLogout, IconMenu } from "../components/Icons";
import { iniciaisDoNome } from "../utils/format";

interface TopbarProps {
  onOpenMobile: () => void;
}

export function Topbar({ onOpenMobile }: TopbarProps) {
  const { user, perfil, sair } = useAuth();
  const [saindo, setSaindo] = useState(false);

  const email = perfil?.email ?? user?.email ?? "";
  const nome =
    perfil?.nome?.trim() ||
    (user?.user_metadata?.["nome"] as string) ||
    email.split("@")[0] ||
    "Usuário";
  const papel = perfil?.papel;

  const handleLogout = async () => {
    setSaindo(true);
    try {
      await sair();
    } finally {
      setSaindo(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobile}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand-400 hover:text-brand-700 lg:hidden"
            aria-label="Abrir menu"
          >
            <IconMenu />
          </button>
          <div className="hidden flex-col sm:flex">
            <span className="text-xs text-ink-faint">Bem-vindo de volta</span>
            <span className="font-display text-sm font-semibold text-brand-700">
              {nome.charAt(0).toUpperCase() + nome.slice(1)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-2 py-1 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
              {iniciaisDoNome(nome)}
            </div>
            <div className="hidden pr-2 text-left md:block">
              <div className="flex max-w-[12rem] items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-ink">
                  {nome}
                </span>
                {papel === "admin" ? (
                  <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-100">
                    Admin
                  </span>
                ) : null}
              </div>
              <div className="max-w-[12rem] truncate text-[0.7rem] text-ink-soft">
                {email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={saindo}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-subtle hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="Sair"
              aria-label="Sair"
            >
              <IconLogout width={16} height={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
