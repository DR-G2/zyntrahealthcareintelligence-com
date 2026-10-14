// B1: bulk user deletion is DISABLED until P5 (full PII erasure + audit). Every non-preflight request
// gets 410 before any auth or DB work. The previous implementation (which could return target addresses)
// was removed on purpose; P5 re-implements it on top of the erasure RPC.
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function handleBulkDelete(req: Request): Response {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ error: "disabled_until_p5" }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(handleBulkDelete);
