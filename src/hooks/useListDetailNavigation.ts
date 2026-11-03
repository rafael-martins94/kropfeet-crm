import { useLocation, type NavigateOptions, type To } from "react-router-dom";

type ListReturnState = {
  returnTo?: string;
};

/**
 * Página de onde se abriu um registro relacionado (ex.: item → ordem de compra).
 * Guarda também o state daquela página para o voltar dela continuar funcionando.
 */
export type OrigemState = {
  origem?: { path: string; state: unknown };
};

export function useListReturnTo(fallbackPath: string): string {
  const location = useLocation();
  const returnTo = (location.state as ListReturnState | null)?.returnTo;
  if (returnTo?.startsWith(fallbackPath)) return returnTo;
  return fallbackPath;
}

export function useListDetailNavigation() {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  const toDetail = (path: string): { to: To; options?: NavigateOptions } => ({
    to: path,
    options: { state: { returnTo } satisfies ListReturnState },
  });

  return { returnTo, toDetail };
}

/** State para abrir outra tela lembrando a atual como origem do voltar. */
export function useStateComOrigem(): (state?: unknown) => OrigemState {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;
  return (state?: unknown) => ({
    ...(state && typeof state === "object" ? state : {}),
    origem: { path, state: location.state },
  });
}

/** Origem registrada pela tela anterior, se houver. */
export function useOrigemNavegacao(): { path: string; state: unknown } | null {
  const location = useLocation();
  const origem = (location.state as OrigemState | null)?.origem;
  return origem?.path ? origem : null;
}
