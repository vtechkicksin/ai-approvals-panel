import type { AIMessageChunk } from '@langchain/core/messages';
import type { AiConfig } from './config';
import type { AiOutcome, CostLogger } from './costLog';
import type { AiFailureReason } from './errors';

export type GuardedEvent =
  | { type: 'chunk'; chunk: AIMessageChunk }
  | { type: 'end'; outcome: AiOutcome; reason?: AiFailureReason };

export interface GuardedStreamOptions {
  feature: string;
  config: AiConfig;
  logger: CostLogger;
  /** Starts one attempt. Must pass `signal` on to the model call. */
  start: (signal: AbortSignal) => Promise<AsyncIterable<AIMessageChunk>>;
  /** Aborted when the client goes away. */
  signal?: AbortSignal;
}

/**
 * Runs a streamed AI call with every guard we need. Yields chunks, then
 * exactly one `end` event. It never throws.
 */
export async function* guardedStream(_options: GuardedStreamOptions): AsyncGenerator<GuardedEvent> {
  throw new Error('Not implemented');
}
