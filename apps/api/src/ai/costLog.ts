import type { AiFailureReason } from './errors';

export type AiOutcome = 'complete' | 'cut_short' | 'failed';

/** One line per AI call: what it cost and how it went. */
export interface AiCallRecord {
  feature: string;
  model: string;
  outcome: AiOutcome;
  reason?: AiFailureReason;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMs: number;
  firstTokenMs: number | null;
}

export interface CostLogger {
  log(record: AiCallRecord): void;
}

/** Structured JSON lines on stdout, ready for any log shipper. */
export function createConsoleCostLogger(): CostLogger {
  throw new Error('Not implemented');
}

/** Keeps records in memory; used by tests. */
export function createMemoryCostLogger(): CostLogger & { records: AiCallRecord[] } {
  throw new Error('Not implemented');
}
