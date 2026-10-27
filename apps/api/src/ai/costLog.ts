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
  return {
    log(record) {
      console.log(JSON.stringify({ event: 'ai_call', at: new Date().toISOString(), ...record }));
    },
  };
}

/** Keeps records in memory; used by tests. */
export function createMemoryCostLogger(): CostLogger & { records: AiCallRecord[] } {
  const records: AiCallRecord[] = [];
  return { records, log: (record) => void records.push(record) };
}
