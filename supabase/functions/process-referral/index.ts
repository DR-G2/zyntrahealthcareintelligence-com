import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { requireUser } from "../_shared/auth.ts";
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
    // The referred account is always the signed-in caller — never a request-chosen ID
    const caller = await requireUser(req);
    if (caller instanceof Response) return caller;
    const referred_user_id = caller.userId;

    const { referral_code } = await req.json();
    if (typeof referral_code !== "string" || !referral_code) {
      throw new Error("Missing referral_code");
    }

    // Each account can only redeem one referral, and only as a new account (first 7 days)
    const { data: prior } = await supabase.from("referrals").select("id").eq("referred_id", referred_user_id).limit(1);
    const { data: prof } = await supabase.from("profiles").select("created_at").eq("id", referred_user_id).maybeSingle();
    const isNew = prof?.created_at && Date.now() - new Date(prof.created_at).getTime() < 7 * 24 * 3600 * 1000;
    if ((prior && prior.length) || !isNew) {
      return new Response(JSON.stringify({ error: "This account is not eligible for a referral bonus" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the referral
    const { data: referral, error: findError } = await supabase
      .from("referrals")
      .select("*")
      .eq("referral_code", referral_code)
      .eq("status", "pending")
      .limit(1)
      .single();

    if (findError || !referral) {
      return new Response(JSON.stringify({ error: "Invalid or already used referral code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-referral
    if (referral.referrer_id === referred_user_id) {
      return new Response(JSON.stringify({ error: "Cannot refer yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    const trialEndISO = trialEnd.toISOString();

    // Update referral status
    await supabase
      .from("referrals")
      .update({
        referred_id: referred_user_id,
        status: "completed",
      })
      .eq("id", referral.id);

    // Grant 7-day trial to both users
    await supabase
      .from("profiles")
      .update({ free_trial_end: trialEndISO })
      .eq("id", referred_user_id);

    await supabase
      .from("profiles")
      .update({ free_trial_end: trialEndISO })
      .eq("id", referral.referrer_id);

    return new Response(JSON.stringify({
      success: true,
      message: "Referral processed! Both users get 7 free days.",
      trial_end: trialEndISO,
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
