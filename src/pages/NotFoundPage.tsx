import { Link } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { PrimaryButton } from "../components/PrimaryButton";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <BrandLogo />
      <div className="mt-10 font-numeric text-7xl font-medium tabular-nums tracking-tight text-brand-700">404</div>
      <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
        Página não encontrada
      </h2>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        O caminho que você tentou acessar não existe ou foi movido.
      </p>
      <Link to="/dashboard" className="mt-6">
        <PrimaryButton>Voltar para o dashboard</PrimaryButton>
      </Link>
    </div>
  );
}
