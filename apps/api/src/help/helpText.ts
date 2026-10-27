import type { Language } from '@approvals/schemas';
import type { PolicyChunk } from './policyChunks';

const TEXT = {
  en: {
    intro: 'Here are the policy sections that match your question:',
    notCovered: "That's not covered by the approval policy. For general questions about the queue, try Talk to me.",
  },
  hi: {
    intro: 'आपके प्रश्न से मेल खाने वाले नीति के भाग ये हैं:',
    notCovered: 'यह अनुमोदन नीति में शामिल नहीं है। कतार के बारे में सामान्य प्रश्नों के लिए Talk to me आज़माएँ।',
  },
} as const;

/** The backup answer: the matching policy sections, word for word. */
export function buildHelpFallback(chunks: readonly PolicyChunk[], language: Language): string {
  return [TEXT[language].intro, ...chunks.map((c) => `${c.heading}\n${c.text}`)].join('\n\n');
}

/** The reply when the policy does not cover the question (no AI call). */
export function notCoveredText(language: Language): string {
  return TEXT[language].notCovered;
}
