import { Navigate, useLocation } from "react-router-dom";

type LegacyRedirectProps = {
  to: string;
  tab?: string;
};

/**
 * Compatibility redirect that preserves the original query string and hash.
 * When a destination tab is supplied, it overrides only the tab parameter and
 * retains every other incoming query parameter.
 */
export function LegacyRedirect({ to, tab }: LegacyRedirectProps) {
  const location = useLocation();
  let search = location.search;

  if (tab) {
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    const query = params.toString();
    search = query ? `?${query}` : "";
  }

  return (
    <Navigate
      to={{ pathname: to, search, hash: location.hash }}
      replace
    />
  );
}
