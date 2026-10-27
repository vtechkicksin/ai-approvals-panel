import type { GreetingFacts } from '@approvals/schemas';

/** Accepts the AI's wording only if it is short and keeps the real count. */
export function isGreetingValid(_text: string, _facts: GreetingFacts): boolean {
  throw new Error('Not implemented');
}
