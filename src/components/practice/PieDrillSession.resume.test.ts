import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/components/practice/PieDrillSession.tsx'), 'utf8');

describe('PIE practice resume pointer', () => {
  it('checks Supabase upsert errors and warns when resume state cannot be saved', () => {
    expect(source).toContain('if (error) throw error;');
    expect(source).toContain('Resume state could not be saved');
  });

  it('surfaces a missing or failed saved pointer instead of silently treating it as an empty config', () => {
    expect(source).toContain('error: resumePointerError');
    expect(source).toContain('if (resumePointerError || !data)');
    expect(source).toContain('The saved session could not be loaded.');
  });
});
