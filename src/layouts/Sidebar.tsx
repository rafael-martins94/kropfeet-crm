import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import {
  IconActivity,
  IconArrows,
  IconBox,
  IconCart,
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconFolder,
  IconImage,
  IconPin,
  IconShoe,
  IconSwap,
  IconTag,
  IconTruck,
  IconUser,
  IconUsers,
  IconX,
} from "../components/Icons";
import { cn } from "../utils/cn";
import type { ReactNode } from "react";

interface MenuItem {
  to: string;
  label: string;
  icon: ReactNode;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menu: MenuGroup[] = [
  {
    label: "Visão geral",
    items: [{ to: "/dashboard", label: "Dashboard", icon: <IconDashboard /> }],
  },
  {
    label: "Catálogo",
    items: [
      { to: "/modelos-produto", label: "Modelos de produto", icon: <IconShoe /> },
      { to: "/itens-estoque", label: "Itens de estoque", icon: <IconBox /> },
      { to: "/marcas", label: "Marcas", icon: <IconTag /> },
      { to: "/categorias", label: "Categorias", icon: <IconFolder /> },
      { to: "/imagens", label: "Imagens", icon: <IconImage /> },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/vendas", label: "Vendas", icon: <IconCart /> },
      { to: "/clientes", label: "Clientes", icon: <IconUser /> },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/locais-estoque", label: "Locais de estoque", icon: <IconPin /> },
      { to: "/fornecedores", label: "Fornecedores", icon: <IconTruck /> },
      { to: "/movimentacoes", label: "Movimentações", icon: <IconArrows /> },
      { to: "/cambios-moeda", label: "Câmbio de moeda", icon: <IconSwap /> },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/usuarios", label: "Usuários", icon: <IconUsers /> },
      { to: "/logs-tiny", label: "Logs Tiny", icon: <IconActivity /> },
    ],
  },
];

export { menu };

const STORAGE_KEY = "kf:sidebar:collapsed";

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-brand-900/50 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface shadow-elevated transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        {/* Cabeçalho: logo + toggle mobile */}
        <div
          className={cn(
            "relative flex items-center justify-center border-b border-line py-5",
            collapsed ? "px-2" : "px-4",
          )}
        >
          {collapsed ? (
            <BrandLogo size="sm" />
          ) : (
            <BrandLogo size="lg" />
          )}

          <button
            type="button"
            onClick={onCloseMobile}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-subtle lg:hidden"
            aria-label="Fechar menu"
          >
            <IconX />
          </button>
        </div>

        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden py-4", collapsed ? "px-2" : "px-3")}>
          {menu.map((grupo) => (
            <div key={grupo.label} className="mb-5">
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-line/80" aria-hidden="true" />
              ) : (
                <div className="mb-2 px-3 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  {grupo.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {grupo.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onCloseMobile}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center rounded-lg text-sm font-medium transition",
                          collapsed
                            ? "h-10 w-full justify-center"
                            : "gap-3 px-3 py-2",
                          isActive
                            ? "bg-brand-600 text-white shadow-sm"
                            : "text-ink-muted hover:bg-surface-subtle hover:text-brand-700",
                        )
                      }
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                        {item.icon}
                      </span>
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Rodapé: toggle + versão */}
        <div
          className={cn(
            "flex border-t border-line",
            collapsed ? "flex-col items-center gap-2 px-2 py-3" : "items-center justify-between px-4 py-3",
          )}
        >
          {!collapsed ? (
            <div className="min-w-0 text-xs leading-tight text-ink-soft">
              <div className="truncate font-medium text-ink">KroopFeet CRM</div>
              <div className="truncate">v0.1</div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-brand-700 lg:flex"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <IconChevronRight width={16} height={16} /> : <IconChevronLeft width={16} height={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}
