import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

/** Verifies admin access against the canonical command.admin_roles user-id contract. */
export function AdminGate({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;
    const userId = user?.id;
    if (!userId) {
      setState("denied");
      return;
    }
    setState("checking");
    void (async () => {
      try {
        const commandClient = (supabase as unknown as { schema: (name: "command") => { rpc: (fn: "is_admin", args: { p_user_id: string }) => Promise<{ data: boolean | null; error: unknown }> } }).schema("command");
        const { data, error } = await commandClient.rpc("is_admin", { p_user_id: userId });
        if (!cancelled) setState(!error && data === true ? "ok" : "denied");
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (state === "checking") return <LazyFallback />;
  if (state === "denied") return <Navigate to="/practice" replace />;

  if (children) return <>{children}</>;
  return <ErrorBoundary><Suspense fallback={<LazyFallback />}><AdminDashboard /></Suspense></ErrorBoundary>;
}
