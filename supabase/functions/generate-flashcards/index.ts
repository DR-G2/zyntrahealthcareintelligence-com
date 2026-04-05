import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Get user's recent incorrect attempts (last 50)
    const { data: attempts } = await supabase
      .from("user_attempts")
      .select("question_id, selected_answer")
      .eq("user_id", user.id)
      .eq("is_correct", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!attempts || attempts.length === 0) {
      return new Response(JSON.stringify({ cards_created: 0, message: "No incorrect attempts found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get question details
    const qIds = [...new Set(attempts.map((a: any) => a.question_id))].slice(0, 20);
    const { data: questions } = await supabase
      .from("questions")
      .select("id, question_text, correct_answer, explanation, category, subtopic")
      .in("id", qIds);

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ cards_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate flashcards using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Generate flashcards from these incorrectly answered medical questions. For each, create a concise front (question/concept) and back (answer/explanation).

Questions:
${questions.map((q: any) => `- ${q.question_text}\n  Answer: ${q.correct_answer}\n  Explanation: ${q.explanation || 'N/A'}\n  Subject: ${q.category}`).join('\n\n')}

Return a JSON array of objects with: front, back, subject, subtopic`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a medical education flashcard generator. Return ONLY valid JSON array." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_flashcards",
            description: "Create flashcards from incorrect answers",
            parameters: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      front: { type: "string" },
                      back: { type: "string" },
                      subject: { type: "string" },
                      subtopic: { type: "string" },
                    },
                    required: ["front", "back"],
                  },
                },
              },
              required: ["cards"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_flashcards" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const { cards } = JSON.parse(toolCall.function.arguments);
    if (!cards || cards.length === 0) {
      return new Response(JSON.stringify({ cards_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or find "My Mistakes" deck
    const deckTitle = "Generated from Mistakes";
    let { data: existingDeck } = await supabase
      .from("flashcard_decks")
      .select("id, card_count")
      .eq("user_id", user.id)
      .eq("title", deckTitle)
      .maybeSingle();

    let deckId: string;
    let oldCount = 0;
    if (existingDeck) {
      deckId = existingDeck.id;
      oldCount = existingDeck.card_count || 0;
    } else {
      const { data: newDeck } = await supabase
        .from("flashcard_decks")
        .insert({ user_id: user.id, title: deckTitle, subject: "Mixed" })
        .select("id")
        .single();
      deckId = newDeck!.id;
    }

    // Insert cards
    const cardRows = cards.map((c: any) => ({
      deck_id: deckId,
      front: c.front,
      back: c.back,
      subject: c.subject || null,
      subtopic: c.subtopic || null,
    }));
    await supabase.from("flashcards").insert(cardRows);

    // Update card count
    await supabase.from("flashcard_decks").update({ card_count: oldCount + cards.length }).eq("id", deckId);

    return new Response(JSON.stringify({ cards_created: cards.length, deck_title: deckTitle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-flashcards error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
