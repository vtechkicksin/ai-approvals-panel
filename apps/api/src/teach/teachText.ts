import type { Language, TeachStep } from '@approvals/schemas';
import type { PolicyChunk } from '../help/policyChunks';

/** The backup answer: the step again, plus what the policy says about it. */
export function buildTeachFallback(_step: TeachStep, _sections: readonly PolicyChunk[], _language: Language): string {
  throw new Error('Not implemented');
}
