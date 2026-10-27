import type { Language } from '@approvals/schemas';
import type { PolicyChunk } from './policyChunks';

/** The backup answer: the matching policy sections, word for word. */
export function buildHelpFallback(_chunks: readonly PolicyChunk[], _language: Language): string {
  throw new Error('Not implemented');
}

/** The reply when the policy does not cover the question (no AI call). */
export function notCoveredText(_language: Language): string {
  throw new Error('Not implemented');
}
