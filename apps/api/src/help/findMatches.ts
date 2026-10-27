import type { PolicyChunk } from './policyChunks';
import type { PolicyRetriever, ScoredChunk } from './policyRetriever';

/** Below this BM25 score a section is not considered a match. */
export const MIN_SCORE = 0.5;
export const TOP_K = 3;

export type MatchResult =
  /** Search found relevant sections. */
  | { mode: 'matched'; matches: ScoredChunk[] }
  /** The question has no searchable English words (e.g. Hindi): the whole, short policy is used. */
  | { mode: 'all'; matches: ScoredChunk[] }
  /** Nothing relevant: the policy does not cover this. */
  | { mode: 'none' };

export function findMatches(_question: string, _retriever: PolicyRetriever, _chunks: readonly PolicyChunk[]): MatchResult {
  throw new Error('Not implemented');
}
