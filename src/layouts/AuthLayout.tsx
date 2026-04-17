import type { ReactNode } from "react";
import { BrandLogo } from "../components/BrandLogo";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-gradient text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-brand-soft opacity-90"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-accent-300/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-brand-400/25 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-between px-6 py-10 lg:flex-row lg:px-12">
        {/* Lado esquerdo: brand + tagline */}
        <div className="w-full max-w-xl lg:w-1/2">
          <BrandLogo variant="light" size="3xl" />
          <h2 className="mt-10 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Gestão inteligente para a <span className="text-accent-300">KroopFeet</span>.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
            Visualize e administre modelos, estoque, fornecedores, vendas e clientes
            com a elegância de uma marca premium e a agilidade de um sistema profissional.
          </p>
        </div>

        {/* Lado direito: card de formulário */}
        <div className="mt-10 w-full max-w-md lg:mt-0">{children}</div>
      </div>

      <footer className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/40">
        © {new Date().getFullYear()} KroopFeet Sneakers · Todos os direitos reservados
      </footer>
    </div>
  );
}
