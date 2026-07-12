import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import {
  IconActivity,
  IconArrows,
  IconBox,
  IconCart,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconFolder,
  IconImage,
  IconLogout,
  IconPin,
  IconShoe,
  IconSwap,
  IconTruck,
  IconUser,
  IconUsers,
  IconX,
} from "../components/Icons";
import { useAuth } from "../contexts/AuthContext";
import { vitrinesService } from "../services/vitrines";
import { iniciaisDoNome } from "../utils/format";
import { cn } from "../utils/cn";
import type { ReactNode } from "react";

interface MenuChild {
  to: string;
  label: string;
}

interface MenuItem {
  to: string;
  label: string;
  icon: ReactNode;
  children?: MenuChild[];
  badgeKey?: "vitrines";
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
      { to: "/categorias", label: "Categorias", icon: <IconFolder /> },
      { to: "/imagens", label: "Imagens", icon: <IconImage /> },
    ],
  },
  {
    label: "Comercial",
    items: [
      {
        to: "/vendas",
        label: "Ordens de venda",
        icon: <IconCart />,
        children: [
          { to: "/vendas/brasil", label: "Brasil" },
          { to: "/vendas/europa", label: "Europa" },
        ],
      },
      { to: "/clientes", label: "Clientes", icon: <IconUser /> },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/locais-estoque", label: "Locais de estoque", icon: <IconPin /> },
      { to: "/vitrines", label: "Vitrines", icon: <IconBox />, badgeKey: "vitrines" },
      { to: "/conferencia-estoque", label: "Conferência de estoque", icon: <IconCheck /> },
      { to: "/ordens-compra", label: "Ordens de compra", icon: <IconCart /> },
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

function caminhoSobPrefixo(pathname: string, prefixo: string) {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

const STORAGE_KEY = "kf:sidebar:collapsed";

function SidebarUsuarioRodape({ collapsed }: { collapsed: boolean }) {
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
    <div
      className={cn(
        "border-t border-line bg-surface-muted/40",
        collapsed ? "px-2 py-3" : "px-3 py-3",
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-[0.65rem] font-semibold text-white"
            title={nome}
          >
            {iniciaisDoNome(nome)}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={saindo}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-red-600 disabled:opacity-50"
            title="Sair"
            aria-label="Sair"
          >
            <IconLogout width={16} height={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[0.65rem] font-semibold text-white">
            {iniciaisDoNome(nome)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="truncate text-xs font-semibold text-ink">{nome}</span>
              {papel === "admin" ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-100">
                  Admin
                </span>
              ) : null}
            </div>
            <div className="truncate text-[0.65rem] leading-snug text-ink-soft">{email}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={saindo}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-red-600 disabled:opacity-50"
            title="Sair"
            aria-label="Sair"
          >
            <IconLogout width={16} height={16} />
          </button>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function MenuItemLink({
  item,
  collapsed,
  onNavigate,
  badgeCount,
}: {
  item: MenuItem;
  collapsed: boolean;
  onNavigate: () => void;
  badgeCount?: number;
}) {
  const { pathname } = useLocation();
  const temFilhos = Boolean(item.children?.length);
  const sobRotaPai = caminhoSobPrefixo(pathname, item.to);
  const [aberto, setAberto] = useState(sobRotaPai);
  const mostrarBadge = (badgeCount ?? 0) > 0;

  useEffect(() => {
    if (sobRotaPai) setAberto(true);
  }, [sobRotaPai]);

  if (!temFilhos) {
    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        title={collapsed ? (mostrarBadge ? `${item.label} (${badgeCount})` : item.label) : undefined}
        className={({ isActive }) =>
          cn(
            "relative flex items-center rounded-lg text-sm font-medium transition",
            collapsed ? "h-10 w-full justify-center" : "gap-3 px-3 py-2",
            isActive
              ? "bg-brand-600 text-white shadow-sm"
              : "text-ink-muted hover:bg-surface-subtle hover:text-brand-700",
          )
        }
      >
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">{item.icon}</span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {mostrarBadge ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-white">
                {badgeCount}
              </span>
            ) : null}
          </>
        ) : mostrarBadge ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.58rem] font-bold text-white">
            {badgeCount}
          </span>
        ) : null}
      </NavLink>
    );
  }

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {item.children!.map((filho) => (
          <NavLink
            key={filho.to}
            to={filho.to}
            onClick={onNavigate}
            title={filho.label}
            className={({ isActive }) =>
              cn(
                "flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition",
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-ink-muted hover:bg-surface-subtle hover:text-brand-700",
              )
            }
          >
            <span className="flex h-5 w-5 items-center justify-center text-[0.65rem] font-semibold">
              {filho.label.slice(0, 2).toUpperCase()}
            </span>
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          sobRotaPai
            ? "bg-brand-50 text-brand-800"
            : "text-ink-muted hover:bg-surface-subtle hover:text-brand-700",
        )}
      >
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">{item.icon}</span>
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        <IconChevronRight
          width={14}
          height={14}
          className={cn("flex-shrink-0 text-ink-faint transition-transform", aberto && "rotate-90")}
        />
      </button>
      {aberto ? (
        <ul className="mt-0.5 space-y-0.5 border-l border-line/80 ml-5 pl-2">
          {item.children!.map((filho) => (
            <li key={filho.to}>
              <NavLink
                to={filho.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    isActive
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-ink-muted hover:bg-surface-subtle hover:text-brand-700",
                  )
                }
              >
                {filho.label}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [alertasVitrine, setAlertasVitrine] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      try {
        const count = await vitrinesService.contarAlertasAtual();
        if (!cancelado) setAlertasVitrine(count);
      } catch {
        if (!cancelado) setAlertasVitrine(0);
      }
    };
    void carregar();
    const timer = window.setInterval(carregar, 60_000);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
    };
  }, []);

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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface shadow-elevated transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:h-dvh lg:max-h-dvh lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        {/* Cabeçalho: logo + recolher (desktop) + fechar (mobile) */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-b border-line py-3",
            collapsed ? "px-2" : "px-3",
          )}
        >
          <div className="flex min-w-0 flex-1 justify-center lg:justify-start">
            {collapsed ? <BrandLogo size="sm" /> : <BrandLogo size="lg" />}
          </div>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-brand-700 lg:flex"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <IconChevronRight width={16} height={16} /> : <IconChevronLeft width={16} height={16} />}
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-subtle lg:hidden"
              aria-label="Fechar menu"
            >
              <IconX />
            </button>
          </div>
        </div>

        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-4", collapsed ? "px-2" : "px-3")}>
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
                    <MenuItemLink
                      item={item}
                      collapsed={collapsed}
                      onNavigate={onCloseMobile}
                      badgeCount={item.badgeKey === "vitrines" ? alertasVitrine : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <SidebarUsuarioRodape collapsed={collapsed} />
      </aside>
    </>
  );
}
