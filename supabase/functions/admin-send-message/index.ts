import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("email", userData.user.email)
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, candidate_id, content, subject, thread_id } = await req.json();

    // Action: list_threads — get all threads for admin
    if (action === "list_threads") {
      const { data: threads, error } = await supabase
        .from("admin_message_threads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      // Get unread count per thread
      const threadIds = (threads || []).map((t: any) => t.id);
      let unreadMap: Record<string, number> = {};
      if (threadIds.length > 0) {
        const { data: unread } = await supabase
          .from("admin_messages")
          .select("thread_id")
          .in("thread_id", threadIds)
          .eq("sender_role", "candidate")
          .is("read_at", null);
        for (const msg of unread || []) {
          unreadMap[msg.thread_id] = (unreadMap[msg.thread_id] || 0) + 1;
        }
      }

      return new Response(JSON.stringify({ threads: (threads || []).map((t: any) => ({ ...t, unread_count: unreadMap[t.id] || 0 })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: get_messages — get messages for a thread
    if (action === "get_messages" && thread_id) {
      const { data: messages, error } = await supabase
        .from("admin_messages")
        .select("*")
        .eq("thread_id", thread_id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Mark candidate messages as read
      await supabase
        .from("admin_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", thread_id)
        .eq("sender_role", "candidate")
        .is("read_at", null);

      return new Response(JSON.stringify({ messages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: send (default) — send a message to a candidate
    if (!candidate_id || !content) {
      throw new Error("candidate_id and content required");
    }

    // Get candidate email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", candidate_id)
      .maybeSingle();

    // Upsert thread
    const { data: existingThread } = await supabase
      .from("admin_message_threads")
      .select("id")
      .eq("admin_id", userData.user.id)
      .eq("candidate_id", candidate_id)
      .maybeSingle();

    let threadIdToUse: string;

    if (existingThread) {
      threadIdToUse = existingThread.id;
      await supabase
        .from("admin_message_threads")
        .update({ updated_at: new Date().toISOString(), subject: subject || undefined })
        .eq("id", threadIdToUse);
    } else {
      const { data: newThread, error: threadErr } = await supabase
        .from("admin_message_threads")
        .insert({
          admin_id: userData.user.id,
          candidate_id,
          admin_email: userData.user.email,
          candidate_email: profile?.email || null,
          subject: subject || "No subject",
        })
        .select("id")
        .single();
      if (threadErr) throw threadErr;
      threadIdToUse = newThread.id;
    }

    // Insert message
    const { error: msgErr } = await supabase
      .from("admin_messages")
      .insert({
        thread_id: threadIdToUse,
        sender_role: "admin",
        sender_id: userData.user.id,
        content,
      });
    if (msgErr) throw msgErr;

    // Log activity
    await supabase.from("admin_activity_logs").insert({
      admin_email: userData.user.email,
      action_type: "send_message",
      target_user_id: candidate_id,
      target_user_email: profile?.email || null,
      details: { subject: subject || "No subject" },
    });

    return new Response(JSON.stringify({ success: true, thread_id: threadIdToUse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
