import { z } from 'zod';
import type { PriorityLevel } from './approvals';
import { languageSchema, type Language } from './stream';

export const partOfDaySchema = z.enum(['morning', 'afternoon', 'evening']);
export type PartOfDay = z.infer<typeof partOfDaySchema>;

export const GREETING_MAX_LENGTH = 240;

/** The facts a greeting may mention. Both the browser and the server compute them from the ranked queue. */
export interface GreetingFacts {
  total: number;
  counts: Partial<Record<PriorityLevel, number>>;
  /** Title of the first item to review, if any. */
  firstTitle: string | null;
}

export const greetingRequestSchema = z.object({
  language: languageSchema,
  partOfDay: partOfDaySchema,
});
export type GreetingRequest = z.infer<typeof greetingRequestSchema>;

export function partOfDayAt(_date: Date): PartOfDay {
  throw new Error('Not implemented');
}

export function greetingFacts(_ranked: readonly { title: string; effectivePriority: PriorityLevel }[]): GreetingFacts {
  throw new Error('Not implemented');
}

/** The instant, rule-based greeting. No AI. */
export function buildGreeting(_facts: GreetingFacts, _language: Language, _partOfDay: PartOfDay): string {
  throw new Error('Not implemented');
}
