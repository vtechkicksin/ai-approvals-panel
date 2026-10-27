import type { GreetingFacts, Language, PartOfDay } from '@approvals/schemas';

export interface GreetingPromptInput {
  facts: GreetingFacts;
  template: string;
  language: Language;
  partOfDay: PartOfDay;
}

export const greetingPromptV1 = {
  id: 'greeting',
  version: 1,
  build(_input: GreetingPromptInput): { system: string; user: string } {
    throw new Error('Not implemented');
  },
} as const;
