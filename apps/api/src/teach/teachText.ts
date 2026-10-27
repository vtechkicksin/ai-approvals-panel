import type { Language, TeachStep } from '@approvals/schemas';
import type { PolicyChunk } from '../help/policyChunks';

const TEXT = {
  en: {
    unavailable: (step: TeachStep) =>
      `I can't answer follow-up questions right now. Here is Step ${step.number} again: ${step.text}`,
    policy: 'What the policy says:',
  },
  hi: {
    unavailable: (step: TeachStep) =>
      `मैं अभी आगे के प्रश्नों का उत्तर नहीं दे सकता। यह Step ${step.number} फिर से है: ${step.text}`,
    policy: 'नीति क्या कहती है:',
  },
} as const;

/** The backup answer: the step again, plus what the policy says about it. */
export function buildTeachFallback(step: TeachStep, sections: readonly PolicyChunk[], language: Language): string {
  const t = TEXT[language];
  const parts: string[] = [t.unavailable(step)];
  if (sections.length > 0) parts.push(t.policy, ...sections.map((s) => `${s.heading}\n${s.text}`));
  return parts.join('\n\n');
}
