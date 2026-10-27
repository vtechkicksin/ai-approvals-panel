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

const NON_LATIN_LETTER = /[^\p{Script=Latin}\P{L}]/u;

/**
 * Decides which policy sections a question is about. This is the rule that
 * keeps the AI from answering what the policy does not cover: no match, no
 * AI call. The one exception is a question in another script (Hindi): our
 * English keyword search cannot read it, and the policy is short enough to
 * give the model whole, with the same "only from the policy" grounding.
 */
export function findMatches(question: string, retriever: PolicyRetriever, chunks: readonly PolicyChunk[]): MatchResult {
  const matches = retriever
    .score(question)
    .filter((m) => m.score >= MIN_SCORE)
    .slice(0, TOP_K);
  if (matches.length > 0) return { mode: 'matched', matches };
  if (NON_LATIN_LETTER.test(question)) return { mode: 'all', matches: chunks.map((chunk) => ({ chunk, score: 0 })) };
  return { mode: 'none' };
}
