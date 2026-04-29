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

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-6 px-6 py-10 lg:flex-row lg:justify-between lg:gap-0 lg:px-12">
        {/* Lado esquerdo: brand + tagline */}
        <div className="flex w-full max-w-xl flex-col items-center text-center lg:w-1/2 lg:items-start lg:text-left">
          <BrandLogo variant="light" size="3xl" />
          <h2 className="mt-10 hidden font-display text-4xl font-semibold leading-tight tracking-tight sm:block sm:text-5xl">
            Gestão inteligente para a <span className="text-accent-300">KropFeet</span>.
          </h2>
          <p className="mt-4 hidden max-w-lg text-sm leading-relaxed text-white/80 sm:block sm:text-base">
            Visualize e administre modelos, estoque, fornecedores, vendas e clientes
            com a elegância de uma marca premium e a agilidade de um sistema profissional.
          </p>
        </div>

        {/* Lado direito: card de formulário */}
        <div className="w-full max-w-md">{children}</div>
      </div>

      <footer className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/40">
        © {new Date().getFullYear()} KropFeet Sneakers · Todos os direitos reservados
      </footer>
    </div>
  );
}
