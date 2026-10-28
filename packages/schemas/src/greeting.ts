import { z } from 'zod';
import { PRIORITY_LEVELS, type PriorityLevel } from './approvals';
import { languageSchema, type Language } from './stream';

export const partOfDaySchema = z.enum(['morning', 'afternoon', 'evening']);
export type PartOfDay = z.infer<typeof partOfDaySchema>;

export const GREETING_MAX_LENGTH = 240;

export interface GreetingFacts {
  total: number;
  counts: Partial<Record<PriorityLevel, number>>;
  firstTitle: string | null;
}

export const greetingRequestSchema = z.object({
  language: languageSchema,
  partOfDay: partOfDaySchema,
});
export type GreetingRequest = z.infer<typeof greetingRequestSchema>;

const HELLO: Record<Language, Record<PartOfDay, string>> = {
  en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
  hi: { morning: 'सुप्रभात', afternoon: 'नमस्कार', evening: 'शुभ संध्या' },
};

const LABELS: Record<Language, Record<PriorityLevel, string>> = {
  en: { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' },
  hi: { urgent: 'अत्यावश्यक', high: 'उच्च', medium: 'मध्यम', low: 'निम्न' },
};

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

export function partOfDayAt(date: Date): PartOfDay {
  const hour = date.getHours();
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

export function greetingFacts(ranked: readonly { title: string; effectivePriority: PriorityLevel }[]): GreetingFacts {
  const counts: Partial<Record<PriorityLevel, number>> = {};
  for (const level of PRIORITY_LEVELS) {
    const count = ranked.filter((r) => r.effectivePriority === level).length;
    if (count > 0) counts[level] = count;
  }
  return { total: ranked.length, counts, firstTitle: ranked[0]?.title ?? null };
}

/** "Good morning!" — what the panel says before the queue has loaded. */
export function helloFor(language: Language, partOfDay: PartOfDay): string {
  return `${HELLO[language][partOfDay]}!`;
}

/** The instant, rule-based greeting. No AI. */
export function buildGreeting(facts: GreetingFacts, language: Language, partOfDay: PartOfDay): string {
  const hello = helloFor(language, partOfDay);
  if (facts.total === 0 || !facts.firstTitle) {
    return language === 'hi'
      ? `${hello} कोई अनुमोदन लंबित नहीं है। सब काम पूरा है।`
      : `${hello} No approvals are waiting. You're all caught up.`;
  }

  const counts = PRIORITY_LEVELS.filter((level) => facts.counts[level])
    .map((level) => `${facts.counts[level]} ${LABELS[language][level]}`)
    .join(', ');
  const title = clip(facts.firstTitle, 120);
  const text =
    language === 'hi'
      ? `${hello} ${facts.total} अनुमोदन लंबित हैं (${counts})। “${title}” से शुरू करें।`
      : `${hello} ${facts.total} ${facts.total === 1 ? 'approval is' : 'approvals are'} waiting (${counts}). Start with “${title}”.`;
  return clip(text, GREETING_MAX_LENGTH);
}
