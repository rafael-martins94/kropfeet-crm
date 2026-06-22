import { useLocation, type NavigateOptions, type To } from "react-router-dom";

type ListReturnState = {
  returnTo?: string;
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
