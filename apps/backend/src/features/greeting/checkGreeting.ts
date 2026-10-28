import { GREETING_MAX_LENGTH, type GreetingFacts } from '@approvals/schemas';

const numbersIn = (text: string): string[] => text.match(/\d+/g) ?? [];

/**
 * Accepts the AI's wording only if it is short, keeps the real total, and
 * mentions no number that is not in the facts (no invented counts).
 */
export function isGreetingValid(text: string, facts: GreetingFacts): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > GREETING_MAX_LENGTH) return false;

  const allowed = new Set([
    String(facts.total),
    ...Object.values(facts.counts).map(String),
    ...numbersIn(facts.firstTitle ?? ''),
  ]);
  const used = numbersIn(trimmed);
  return used.includes(String(facts.total)) && used.every((n) => allowed.has(n));
}
