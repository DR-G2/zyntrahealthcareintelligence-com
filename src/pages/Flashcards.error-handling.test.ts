import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/pages/Flashcards.tsx'), 'utf8');
const edge = readFileSync(join(process.cwd(), 'supabase/functions/generate-flashcards/index.ts'), 'utf8');

describe('Flashcards persistence error handling', () => {
  it('does not confuse failed deck queries with an empty deck list', () => {
    expect(source).toContain('setLoadError(\'Flashcard decks could not be loaded. Please retry.\')');
    expect(source).toContain('Flashcard decks unavailable');
    expect(source).toContain('onClick={() => void loadDecks()}');
  });

  it('checks write failures before advancing or showing success', () => {
    expect(source).toContain('if (insertError) throw insertError;');
    expect(source).toContain('if (error) throw error;');
    expect(source).toContain('Review progress was not saved');
  });

  it('does not report generated cards as saved when persistence fails', () => {
    expect(edge).toContain('if (insertCardsError) throw new Error("Generated flashcards could not be saved.")');
    expect(edge).toContain('if (countUpdateError)');
    expect(edge).toContain('.eq("user_id", user.id)');
  });
});
