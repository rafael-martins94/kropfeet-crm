import type { ReactNode } from "react";
import { IconSparkles } from "./Icons";

interface HeroSectionProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function HeroSection({ title, subtitle, eyebrow, actions }: HeroSectionProps) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl bg-brand-gradient text-white shadow-elevated">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-brand-soft opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent-300/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-brand-400/25 blur-3xl"
      />
      <div className="relative flex flex-col gap-6 px-6 py-9 sm:px-10 sm:py-12 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-accent-200 ring-1 ring-inset ring-white/15 backdrop-blur">
              <IconSparkles width={12} height={12} />
              {eyebrow}
            </div>
          ) : null}
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-[2.6rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
