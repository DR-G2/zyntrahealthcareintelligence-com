import { Navigate, useLocation } from "react-router-dom";

type LegacyRedirectProps = {
  to: string;
  tab?: string;
};

/** Compatibility redirect preserving existing query parameters and hash fragments. */
export function LegacyRedirect({ to, tab }: LegacyRedirectProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (tab) params.set("tab", tab);
  const search = params.toString();
  return (
    <Navigate
      to={{ pathname: to, search: search ? `?${search}` : "", hash: location.hash }}
      replace
    />
  );
}
