import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_flashcard_deck",
  title: "Create a flashcard deck",
  description:
    "Create a new flashcard deck for the signed-in candidate and add cards to it, ready for spaced-repetition review in the app.",
  inputSchema: {
    title: z.string().trim().min(1).max(120).describe("Deck title."),
    subject: z.string().trim().min(1).max(80).optional().describe("AMC subject the deck belongs to."),
    cards: z
      .array(
        z.object({
          front: z.string().trim().min(1).describe("Prompt side of the card."),
          back: z.string().trim().min(1).describe("Answer side of the card."),
          subtopic: z.string().trim().min(1).max(120).optional().describe("Subtopic for this card."),
        }),
      )
      .min(1)
      .max(50)
      .describe("Cards to add to the new deck (1-50)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, subject, cards }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data: deck, error: deckError } = await supabase
      .from("flashcard_decks")
      .insert({ user_id: ctx.getUserId() ?? "", title, subject: subject ?? null, card_count: cards.length })
      .select("id, title, subject, card_count")
      .single();

    if (deckError) throw new ToolError(deckError.message);

    const { error: cardsError } = await supabase.from("flashcards").insert(
      cards.map((card) => ({
        deck_id: deck.id,
        front: card.front,
        back: card.back,
        subject: subject ?? null,
        subtopic: card.subtopic ?? null,
      })),
    );

    if (cardsError) {
      await supabase.from("flashcard_decks").delete().eq("id", deck.id);
      throw new ToolError(`Deck could not be filled: ${cardsError.message}`);
    }

    const created = {
      id: deck.id,
      title: deck.title,
      subject: deck.subject ?? null,
      cardCount: cards.length,
    };

    return {
      content: [{ type: "text", text: `Created deck "${created.title}" with ${created.cardCount} cards.` }],
      structuredContent: { deck: created },
    };
  },
});
