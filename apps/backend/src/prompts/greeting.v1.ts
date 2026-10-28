import type { GreetingFacts, Language, PartOfDay } from '@approvals/schemas';

export interface GreetingPromptInput {
  facts: GreetingFacts;
  template: string;
  language: Language;
  partOfDay: PartOfDay;
}

const LANGUAGE_RULE: Record<Language, string> = {
  en: 'Write in English.',
  hi: 'Write in Hindi, using Devanagari script. Keep the item title exactly as given.',
};

/**
 * v1: an optional, friendlier wording of the rule-based greeting. The
 * template already has every fact; the model may only change the wording.
 * The server checks the numbers before accepting it.
 */
export const greetingPromptV1 = {
  id: 'greeting',
  version: 1,
  build({ facts, template, language, partOfDay }: GreetingPromptInput): { system: string; user: string } {
    const system = [
      'You reword a short greeting for a site operator who has just opened the approvals assistant.',
      '',
      'Rules:',
      '- Reword the template in one or two short, warm sentences (under 200 characters).',
      '- Keep every number exactly as in the template, written as digits.',
      '- Do not add facts, items, deadlines or advice that are not in the template.',
      '- Reply with the greeting only, no quotes or markdown.',
      `- ${LANGUAGE_RULE[language]}`,
    ].join('\n');
    const user = `Part of day: ${partOfDay}\nFacts: ${JSON.stringify(facts)}\nTemplate: ${template}`;
    return { system, user };
  },
} as const;
