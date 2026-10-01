export interface ParsedOptionLine {
  letter: string;
  text: string;
}

export interface ParsedExplanation {
  lead: string;
  options: ParsedOptionLine[];
  diagnosis: string;
  takeaways: string[];
}

const HEADING = /^(correct answer|why the others fail|why other options are wrong|clinical trap|incorrect answer analysis)\s*$/i;

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHeading(line: string): string {
  return line.replace(/^\*+\s*/, '').replace(/\*+$/, '').trim();
}

export function parseExplanation(raw: string | null | undefined, options: string[], correctAnswer: string): ParsedExplanation {
  const lines = (raw || '').split(/\n+/).map(stripHeading).filter(Boolean);
  const leadParts: string[] = [];
  const byLetter: Record<string, string> = {};
  let trap = '';
  let mode: 'lead' | 'options' | 'trap' = 'lead';

  for (const line of lines) {
    if (HEADING.test(line)) {
      if (/trap/i.test(line)) mode = 'trap';
      else if (/why|incorrect/i.test(line)) mode = 'options';
      else mode = 'lead';
      continue;
    }
    const optionMatch = line.match(/^([A-E])[.)]\s+(.+)$/);
    if (optionMatch) {
      mode = 'options';
      byLetter[optionMatch[1]] = clean(optionMatch[2]);
      continue;
    }
    if (mode === 'trap') trap = clean(`${trap} ${line}`);
    else if (mode === 'lead') leadParts.push(line);
  }

  const lead = clean(leadParts.join(' '));
  const parsedOptions = options.map((option, index) => {
    const letter = String.fromCharCode(65 + index);
    const stored = byLetter[letter];
    const text = stored
      ? stored.replace(new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?\\s*`, 'i'), '').trim() || stored
      : letter === correctAnswer
        ? 'This is the option that matches the deciding fact in the case.'
        : 'This does not fit the deciding fact in the case.';
    return { letter, text };
  });

  const correct = options[Math.max(0, correctAnswer.charCodeAt(0) - 65)] || 'the keyed option';
  const diagnosis = clean(
    `${correct} is the decision this case supports. ${leadParts[0] || 'The deciding fact is in the story.'} ${trap}`
  );

  const takeaways = [leadParts[0], trap].map(clean).filter(Boolean).slice(0, 2);
  return { lead: lead || 'Read the deciding fact in the case, then match it to one option.', options: parsedOptions, diagnosis, takeaways };
}
