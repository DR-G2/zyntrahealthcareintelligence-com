import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LEGACY_AUTH_URL = "https://yudkfmgilucyhukfggij.supabase.co/auth/v1/user";
const LEGACY_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1ZGtmbWdpbHVjeWh1a2ZnZ2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTExNTksImV4cCI6MjA4ODEyNzE1OX0.ONt4wVkqJ8-9Jbp8k_P_o5BCSxChHGeXIdaNPH1--yg";
const allowedOrigins = new Set([
  "https://www.zyntrahealthcareintelligence.com",
  "https://zyntrahealthcareintelligence.com",
]);
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
    ? origin
    : "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));\n  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
    if (!LEGACY_PUBLISHABLE_KEY) return Response.json({ error: "Legacy auth bridge is not configured." }, { status: 500, headers: cors });

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Legacy authentication required." }, { status: 401, headers: cors });

    const legacyResponse = await fetch(LEGACY_AUTH_URL, {
      headers: { apikey: LEGACY_PUBLISHABLE_KEY, Authorization: authorization },
    });
    if (!legacyResponse.ok) return Response.json({ error: "Legacy session could not be verified." }, { status: 401, headers: cors });

    const legacyUser = await legacyResponse.json();
    const email = typeof legacyUser?.email === "string" ? legacyUser.email.toLowerCase() : "";
    if (!email || typeof legacyUser?.id !== "string") {
      return Response.json({ error: "Legacy account did not return a usable identity." }, { status: 401, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;

    let v2User = existing.users.find((u) => u.email?.toLowerCase() === email);
    if (!v2User) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { source: "legacy_auth_bridge", legacy_user_id: legacyUser.id },
      });
      if (error || !created.user) throw error ?? new Error("V2 user creation failed.");
      v2User = created.user;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: v2User.id,
      email,
      display_name: typeof legacyUser.user_metadata?.full_name === "string"
        ? legacyUser.user_metadata.full_name.slice(0, 120)
        : null,
      role: "learner",
      status: "active",
    }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError) throw linkError;

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) throw new Error("V2 magic-link token could not be generated.");

    return Response.json({
      ok: true,
      email,
      v2_user_id: v2User.id,
      token_hash: tokenHash,
      type: "magiclink",
    }, { headers: cors });
  } catch (error) {
    console.error("v2-auth-bridge error", error);
    return Response.json({
      error: error instanceof Error ? error.message : "V2 authentication bridge failed.",
    }, { status: 500, headers: cors });
  }
});