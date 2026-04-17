import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar mobileOpen={menuAberto} onCloseMobile={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobile={() => setMenuAberto(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="border-t border-line bg-surface px-4 py-4 text-center text-xs text-ink-soft sm:px-6 lg:px-8">
          © {new Date().getFullYear()} KroopFeet Sneakers · Sistema interno
        </footer>
      </div>
    </div>
  );
}
