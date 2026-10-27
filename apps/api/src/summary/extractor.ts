import type { SummaryCard, SummaryStreamEvent } from '@approvals/schemas';

/** What the model has finished so far: only fields that are known to be complete. */
export interface ExtractorSnapshot {
  /** Set once the model has moved past the headline. */
  headline?: string;
  /** Reasons of items that passed their check, by id. */
  reasons: Record<string, string>;
}

export interface SummaryExtractor {
  /** Feed the next piece of the model's JSON text; returns events to send now. */
  push(text: string): SummaryStreamEvent[];
  /** The stream is over: confirm or replace any item that is still open. */
  finish(): SummaryStreamEvent[];
  /** All text received so far. */
  readonly text: string;
  snapshot(): ExtractorSnapshot;
}

/**
 * Turns the model's streaming JSON into safe, typed events: only appended
 * text for known fields and known item ids, cut at the length limits, with a
 * per-item check as soon as each item is complete.
 */
export function createSummaryExtractor(_cards: readonly SummaryCard[]): SummaryExtractor {
  throw new Error('Not implemented');
}
