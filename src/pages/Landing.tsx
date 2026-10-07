import { ChevronRight, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/**
 * /check: free AMC readiness check.
 *
 * P5: the anonymous six-question diagnostic was removed. It ran on legacy RPCs
 * (get_diagnostic_question / submit_diagnostic_answer) with a client-held "used ids" list,
 * outside PIE, so its answers could never count as evidence. The readiness check is now the
 * PIE diagnostic (/assess): a server-built, blueprint-balanced set, graded server-side by
 * save_attempt in a PIE-registered session. It needs an account, so this page routes there.
 */
export default function Landing() {
  const { user } = useAuth();
  const target = user ? "/assess" : "/login?next=%2Fassess";

  return (
    <main className="min-h-screen bg-[#f6fbfc] px-4 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">AMC readiness check</div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#0f5f68]">
          A diagnostic balanced across the AMC blueprint
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500">
          Zyntra builds your diagnostic on the server across every patient group, grades each answer
          securely, and uses it to start your adaptive practice plan.
        </p>
        <div className="mx-auto mt-8 max-w-md">
          <Button asChild className="h-12 w-full rounded-xl bg-[#0f5f68] text-base font-semibold shadow-sm hover:bg-[#0a4b52]">
            <Link to={target}>
              <Brain className="mr-2 h-4 w-4" />
              {user ? "Start the diagnostic" : "Log in to start the diagnostic"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
