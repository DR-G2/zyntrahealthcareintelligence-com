import { useState } from "react";
import { RefreshCw, ShieldCheck, XCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ADMIN_EMAILS } from "@/lib/admin-emails";

export default function V2AuthDiagnostic() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; status?: number; payload?: unknown; error?: string } | null>(null);

  const runTest = async () => {
    setRunning(true);
    setResult(null);

    try {
      if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
        throw new Error("This diagnostic is restricted to a Zyntra admin account.");
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error("Could not read the current Zyntra session: " + error.message);

      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("No active Zyntra session. Please sign in again.");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_V2_URL}/functions/v1/v2-admin-auth-bridge`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const payload = await response.json().catch(() => ({ raw: "Non-JSON response" }));
      setResult({ ok: response.ok, status: response.status, payload });
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(false);
    }
  };

  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email));

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                <ShieldCheck className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <CardTitle>V2 Authentication Diagnostic</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Isolated test. This does not start Practice or create a V2 practice session.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border/60 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current account</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm">{user?.email ?? "Not signed in"}</span>
                <Badge variant={isAdmin ? "default" : "destructive"}>
                  {isAdmin ? "ADMIN" : "NOT ADMIN"}
                </Badge>
              </div>
            </div>

            <Button onClick={runTest} disabled={running || !isAdmin} className="w-full">
              {running ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {running ? "Testing V2 Auth Bridge…" : "Test V2 Auth Bridge"}
            </Button>

            {result && (
              <div className={`rounded-xl border p-4 ${result.ok ? "border-emerald-400/30 bg-emerald-400/[0.05]" : "border-red-400/30 bg-red-400/[0.05]"}`}>
                <div className="flex items-center gap-2 font-medium">
                  {result.ok
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    : <XCircle className="h-5 w-5 text-red-400" />}
                  {result.ok ? "Bridge responded successfully" : "Bridge test failed"}
                  {result.status ? <span className="text-xs text-muted-foreground">HTTP {result.status}</span> : null}
                </div>
                <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(result.payload ?? result.error, null, 2)}
                </pre>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              This page only tests the existing legacy-session → V2-admin bridge.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
