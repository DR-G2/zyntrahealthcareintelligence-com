import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/admin-emails";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

/** Verifies admin server-side (is_admin RPC) before rendering protected content. */
export function AdminGate({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;
    const email = user?.email;
    if (!email || !ADMIN_EMAILS.includes(email)) {
      setState("denied");
      return;
    }
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("is_admin", { _email: email });
        if (!cancelled) setState(!error && data === true ? "ok" : "denied");
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  if (state === "checking") return <LazyFallback />;
  if (state === "denied") return <Navigate to="/practice" replace />;

  if (children) return <>{children}</>;
  return <ErrorBoundary><Suspense fallback={<LazyFallback />}><AdminDashboard /></Suspense></ErrorBoundary>;
}
