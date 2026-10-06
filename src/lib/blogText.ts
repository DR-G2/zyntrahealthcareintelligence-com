/** Helpers for public blog articles (read time, dates, inline links). */

export const WORDS_PER_MINUTE = 200;

export type BlogSection = { title: string; body: string };
export type BlogBody = { intro: string; sections: BlogSection[] };

export type InlineSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Splits text containing markdown-style [label](url) links into text and link segments. */
export function parseInlineLinks(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", text: text.slice(last, index) });
    segments.push({ type: "link", text: match[1], href: match[2] });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

/** Visible text only: link labels are kept, URLs are dropped. */
export function toPlainText(text: string): string {
  return text.replace(LINK_RE, "$1");
}

export function countWords(text: string): number {
  const words = toPlainText(text).trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function articleWordCount(body: BlogBody): number {
  return countWords(body.intro) + body.sections.reduce((sum, s) => sum + countWords(s.title) + countWords(s.body), 0);
}

/** Read time rounded up to whole minutes at WORDS_PER_MINUTE, minimum 1 minute. */
export function readTimeLabel(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats an ISO date (YYYY-MM-DD) as e.g. "3 Oct 2026" without timezone drift. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
