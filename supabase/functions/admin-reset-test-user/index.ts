import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const ADMIN_EMAIL = "gopalrock.naren@gmail.com";
const TEST_EMAIL = "testuser123@zyntr.website";
const TEST_PASSWORD = "gNs@2304";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || userData.user?.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // Find existing user
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = listData?.users?.find((u: any) => u.email === TEST_EMAIL);

    if (existingUser) {
      const uid = existingUser.id;
      // Clean up related data
      await supabase.from("user_attempts").delete().eq("user_id", uid);
      await supabase.from("bookmarks").delete().eq("user_id", uid);
      await supabase.from("user_notes").delete().eq("user_id", uid);
      await supabase.from("user_progress").delete().eq("user_id", uid);
      await supabase.from("behavior_profiles").delete().eq("user_id", uid);
      await supabase.from("performance_profiles").delete().eq("user_id", uid);
      await supabase.from("study_plans").delete().eq("user_id", uid);
      await supabase.from("chat_conversations").delete().eq("user_id", uid);
      await supabase.from("station_attempts").delete().eq("user_id", uid);
      await supabase.from("clinical_stations").delete().eq("user_id", uid);
      await supabase.from("psychograph_history").delete().eq("user_id", uid);
      await supabase.from("profiles").delete().eq("id", uid);
      // Delete auth user
      await supabase.auth.admin.deleteUser(uid);
    }

    // Create fresh user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (createError) throw createError;

    return new Response(JSON.stringify({
      success: true,
      message: `Test account reset. Email: ${TEST_EMAIL}`,
      user_id: newUser.user?.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
