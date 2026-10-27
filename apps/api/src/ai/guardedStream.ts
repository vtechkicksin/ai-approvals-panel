import type { AIMessageChunk } from '@langchain/core/messages';
import type { AiConfig } from './config';
import type { AiOutcome, CostLogger } from './costLog';
import { classifyAiError, isRetryable, type AiFailureReason } from './errors';
import { costUsd } from './pricing';

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

const MAX_ATTEMPTS = 2;

/** A visible word: text, or a piece of tool-call JSON. The empty "message started" chunk is not one. */
function hasContent(chunk: AIMessageChunk): boolean {
  return chunk.text.length > 0 || (chunk.tool_call_chunks ?? []).some((t) => Boolean(t.args));
}

class AttemptAborted extends Error {}

/**
 * Runs a streamed AI call with every guard we need:
 * - first-word limit (shared by both attempts), then a silence limit between words
 * - one retry for quick, temporary failures, only before the first word
 * - cancellation when the client goes away
 * - a cost/timing log line for every call
 *
 * Yields chunks, then exactly one `end` event. It never throws.
 */
export async function* guardedStream(options: GuardedStreamOptions): AsyncGenerator<GuardedEvent> {
  const { config, logger, feature, signal: clientSignal } = options;
  const startedAt = Date.now();
  const deadline = startedAt + config.firstTokenTimeoutMs;
  let attempts = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let firstTokenAt: number | null = null;

  const finish = (outcome: AiOutcome, reason?: AiFailureReason): GuardedEvent => {
    logger.log({
      feature,
      model: config.model,
      outcome,
      ...(reason && { reason }),
      attempts,
      inputTokens,
      outputTokens,
      costUsd: costUsd(config.model, inputTokens, outputTokens),
      latencyMs: Date.now() - startedAt,
      firstTokenMs: firstTokenAt === null ? null : firstTokenAt - startedAt,
    });
    return reason ? { type: 'end', outcome, reason } : { type: 'end', outcome };
  };

  if (clientSignal?.aborted) {
    yield finish('failed', 'cancelled');
    return;
  }

  for (;;) {
    attempts += 1;
    const attempt = new AbortController();
    let abortReason: AiFailureReason | null = null;
    let completed = false;
    const abort = (reason: AiFailureReason) => {
      if (abortReason) return;
      abortReason = reason;
      attempt.abort();
    };

    // Rejects as soon as this attempt is aborted, so a hung connection or a
    // silent stream can never keep us waiting past our own limits.
    const aborted = new Promise<never>((_, reject) => {
      attempt.signal.addEventListener('abort', () => reject(new AttemptAborted()), { once: true });
    });
    aborted.catch(() => {});

    const onClientAbort = () => abort('cancelled');
    clientSignal?.addEventListener('abort', onClientAbort, { once: true });

    let timer = setTimeout(() => abort('first_token_timeout'), Math.max(0, deadline - Date.now()));
    const restartSilenceTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => abort('stalled'), config.idleTimeoutMs);
    };

    try {
      const iterable = await Promise.race([Promise.resolve().then(() => options.start(attempt.signal)), aborted]);
      const iterator = iterable[Symbol.asyncIterator]();

      for (;;) {
        const next = await Promise.race([iterator.next(), aborted]);
        if (next.done) break;

        const chunk = next.value;
        inputTokens += chunk.usage_metadata?.input_tokens ?? 0;
        outputTokens += chunk.usage_metadata?.output_tokens ?? 0;
        if (firstTokenAt === null && hasContent(chunk)) firstTokenAt = Date.now();
        if (firstTokenAt !== null) restartSilenceTimer();

        yield { type: 'chunk', chunk };
      }

      completed = true;
      yield finish('complete');
      return;
    } catch (err) {
      const reason = abortReason ?? classifyAiError(err);

      if (firstTokenAt !== null) {
        yield finish('cut_short', reason);
        return;
      }
      const timeLeft = deadline - Date.now();
      if (isRetryable(reason) && attempts < MAX_ATTEMPTS && timeLeft >= config.minRetryWindowMs) continue;

      yield finish('failed', reason);
      return;
    } finally {
      clearTimeout(timer);
      clientSignal?.removeEventListener('abort', onClientAbort);
      // Also covers a consumer that stops reading early: never leave an HTTP call running.
      if (!completed) attempt.abort();
    }
  }
}
