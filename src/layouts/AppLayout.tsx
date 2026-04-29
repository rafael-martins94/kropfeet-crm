import { useState } from "react";
import { Outlet } from "react-router-dom";
import { IconMenu } from "../components/Icons";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-surface-muted">
      <Sidebar mobileOpen={menuAberto} onCloseMobile={() => setMenuAberto(false)} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          className="fixed left-3 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted shadow-md transition hover:border-brand-400 hover:text-brand-700 lg:hidden"
          aria-label="Abrir menu"
        >
          <IconMenu />
        </button>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-6 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:py-6">
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
