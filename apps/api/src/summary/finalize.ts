import type { AnswerSource, Language, Summary, SummaryCard } from '@approvals/schemas';
import type { ExtractorSnapshot } from './extractor';

export interface FinalSummary {
  summary: Summary;
  source: Extract<AnswerSource, 'ai' | 'partial' | 'fallback'>;
}

/**
 * For a reply that was cut short: keeps only the parts the model finished and
 * that passed their checks; everything else is rule-based.
 */
export function finalizeFromSnapshot(
  _snapshot: ExtractorSnapshot,
  _cards: readonly SummaryCard[],
  _language: Language,
): FinalSummary {
  throw new Error('Not implemented');
}

/**
 * Validates the model's full JSON and builds the final summary in the queue's
 * ranked order. Unusable parts are replaced by rule-based text, never trusted.
 */
export function finalizeSummary(_rawText: string, _cards: readonly SummaryCard[], _language: Language): FinalSummary {
  throw new Error('Not implemented');
}
