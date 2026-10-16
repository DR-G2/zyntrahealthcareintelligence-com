import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/admin-emails";

type AdminGateProps = { children: ReactNode };

/** Verifies the signed-in user with the server before rendering any admin-only page. */
export function AdminGate({ children }: AdminGateProps) {
  const { user } = useAuth();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;
    const email = user?.email;
    if (!email || !ADMIN_EMAILS.includes(email)) {
      setState("denied");
      return;
    }
    setState("checking");
    supabase.rpc("is_admin", { _email: email }).then(({ data, error }) => {
      if (!cancelled) setState(!error && data === true ? "ok" : "denied");
    }).catch(() => {
      if (!cancelled) setState("denied");
    });
    return () => { cancelled = true; };
  }, [user?.email]);

  if (state === "checking") {
    return <div className="flex items-center justify-center min-h-screen bg-background" role="status" aria-label="Checking administrator access"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (state === "denied") return <Navigate to="/practice" replace />;
  return <>{children}</>;
}
