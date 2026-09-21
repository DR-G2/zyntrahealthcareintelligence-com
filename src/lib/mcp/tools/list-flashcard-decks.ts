import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_flashcard_decks",
  title: "List flashcard decks",
  description:
    "List the signed-in candidate's flashcard decks, optionally including the cards inside each deck.",
  inputSchema: {
    include_cards: z.boolean().default(false).describe("Include the front/back of each card in every deck."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_cards }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId() ?? "";

    const { data, error } = await supabase
      .from("flashcard_decks")
      .select("id, title, subject, card_count, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw new ToolError(error.message);

    const decks = (data ?? []).map((deck) => ({
      id: deck.id,
      title: deck.title,
      subject: deck.subject ?? null,
      cardCount: deck.card_count,
      createdAt: deck.created_at,
      updatedAt: deck.updated_at,
      cards: [] as { id: string; front: string; back: string; subtopic: string | null }[],
    }));

    if (include_cards && decks.length > 0) {
      const { data: cards, error: cardsError } = await supabase
        .from("flashcards")
        .select("id, deck_id, front, back, subtopic")
        .in("deck_id", decks.map((deck) => deck.id));
      if (cardsError) throw new ToolError(cardsError.message);
      for (const card of cards ?? []) {
        const deck = decks.find((d) => d.id === card.deck_id);
        deck?.cards.push({ id: card.id, front: card.front, back: card.back, subtopic: card.subtopic ?? null });
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(decks, null, 2) }],
      structuredContent: { decks },
    };
  },
});
