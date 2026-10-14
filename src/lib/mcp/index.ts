import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getStudyProfile from "./tools/get-study-profile";
import getReadiness from "./tools/get-readiness";
import listRecentAttempts from "./tools/list-recent-attempts";
import getSubjectBreakdown from "./tools/get-subject-breakdown";
import listStationAttempts from "./tools/list-station-attempts";
import listFlashcardDecks from "./tools/list-flashcard-decks";
import createFlashcardDeck from "./tools/create-flashcard-deck";

// P3: issuer comes from env only (hkow via VITE_SUPABASE_URL); no hard-coded project/key fallback.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is not set; MCP OAuth issuer cannot be configured.");

export default defineMcp({
  name: "zyntra-healthcare-intelligence",
  title: "Zyntra Healthcare Intelligence",
  version: "0.1.0",
  instructions:
    "Tools for Zyntra, an AMC exam preparation platform. Acting as the signed-in candidate, read their study profile, readiness scores, MCQ attempt history, subject-by-subject accuracy and OSCE clinical station attempts, and create flashcard decks for spaced-repetition review. Use get_subject_breakdown to find weak subjects before recommending study focus.",
  auth: auth.oauth.issuer({
    issuer: `${supabaseUrl}/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getStudyProfile,
    getReadiness,
    listRecentAttempts,
    getSubjectBreakdown,
    listStationAttempts,
    listFlashcardDecks,
    createFlashcardDeck,
  ],
});
