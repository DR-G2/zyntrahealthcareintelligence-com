import { Navigate, useLocation } from 'react-router-dom';

/**
 * Compatibility redirect for bookmarked /settings URLs.
 * Keeps query strings and hash fragments intact when moving to the canonical Account route.
 */
export function LegacySettingsRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/account', search: location.search, hash: location.hash }} replace />;
}
