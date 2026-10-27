import type { AIMessageChunk } from '@langchain/core/messages';
import { createMemoryCostLogger } from '../../../src/ai/costLog';
import { AiNotConfiguredError } from '../../../src/ai/errors';
import { guardedStream, type GuardedEvent, type GuardedStreamOptions } from '../../../src/ai/guardedStream';
import { delay, hang, messageStart, textReply, toolUseReply, type FakeReply } from '../../helpers/fakeAnthropic';
import { fakeModel, testAiConfig } from '../../helpers/aiTestKit';

// testAiConfig: first word within 300ms, silence limit 150ms, retry only if ≥100ms left.

async function run(options: Partial<GuardedStreamOptions> & { replies?: FakeReply[] }) {
  const { model, fake } = fakeModel(...(options.replies ?? [{ kind: 'stream', steps: textReply(['Hi']) }]));
  const logger = createMemoryCostLogger();
  const started = Date.now();
  const events: GuardedEvent[] = [];
  for await (const event of guardedStream({
    feature: 'test',
    config: testAiConfig,
    logger,
    start: (signal) => model.stream('Hello', { signal }),
    ...options,
  })) {
    events.push(event);
  }
  return { events, fake, logger, elapsed: Date.now() - started };
}

const texts = (events: GuardedEvent[]) =>
  events.flatMap((e) => (e.type === 'chunk' && e.chunk.text ? [e.chunk.text] : []));
const end = (events: GuardedEvent[]) => events.at(-1);

describe('guardedStream', () => {
  describe('happy path', () => {
    it('passes chunks through and ends complete', async () => {
      const { events } = await run({ replies: [{ kind: 'stream', steps: textReply(['Four ', 'waiting.']) }] });

      expect(texts(events)).toEqual(['Four ', 'waiting.']);
      expect(end(events)).toEqual({ type: 'end', outcome: 'complete' });
      expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
    });

    it('logs model, tokens, cost and timing for the call', async () => {
      const { logger } = await run({});

      expect(logger.records).toHaveLength(1);
      expect(logger.records[0]).toMatchObject({
        feature: 'test',
        model: 'claude-haiku-5-5',
        outcome: 'complete',
        attempts: 1,
        inputTokens: 12,
      });
      expect(logger.records[0]!.outputTokens).toBeGreaterThan(0);
      expect(logger.records[0]!.costUsd).toBeGreaterThan(0);
      expect(logger.records[0]!.firstTokenMs).toEqual(expect.any(Number));
    });

    it('counts streamed tool-call JSON as the first word', async () => {
      const { events } = await run({ replies: [{ kind: 'stream', steps: toolUseReply('emit', ['{"a":', '1}']) }] });

      expect(end(events)).toEqual({ type: 'end', outcome: 'complete' });
    });

    it('lets a slow but steady reply finish, even past the first-word limit', async () => {
      const pieces = ['a', 'b', 'c', 'd', 'e']; // 100ms apart: 400ms total, never 150ms of silence
      const { events } = await run({ replies: [{ kind: 'stream', steps: textReply(pieces, { gapMs: 100 }) }] });

      expect(texts(events)).toEqual(pieces);
      expect(end(events)).toEqual({ type: 'end', outcome: 'complete' });
    });
  });

  describe('8s first-word limit', () => {
    it('gives up when no word arrives in time, and cancels the HTTP call', async () => {
      const { events, fake, elapsed, logger } = await run({
        replies: [{ kind: 'stream', steps: [messageStart(), hang()] }],
      });

      expect(end(events)).toEqual({ type: 'end', outcome: 'failed', reason: 'first_token_timeout' });
      expect(elapsed).toBeLessThan(500);
      expect(fake.calls[0]!.signal?.aborted).toBe(true);
      expect(fake.calls).toHaveLength(1); // no retry after a timeout
      expect(logger.records[0]).toMatchObject({ outcome: 'failed', reason: 'first_token_timeout' });
    });

    it('does not count the empty "message started" event as a word', async () => {
      const { events } = await run({
        replies: [{ kind: 'stream', steps: [messageStart(), delay(400), ...textReply(['late']).slice(1)] }],
      });

      expect(end(events)).toMatchObject({ outcome: 'failed', reason: 'first_token_timeout' });
      expect(texts(events)).toEqual([]);
    });

    it('also times out when the connection itself never answers', async () => {
      const { events, elapsed } = await run({ start: () => new Promise<AsyncIterable<AIMessageChunk>>(() => {}) });

      expect(end(events)).toMatchObject({ outcome: 'failed', reason: 'first_token_timeout' });
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('5s silence rule', () => {
    it('stops a reply that goes quiet, keeping what already arrived', async () => {
      const steps = [...textReply(['Partial answer']).slice(0, 3), hang()];
      const { events, elapsed } = await run({ replies: [{ kind: 'stream', steps }] });

      expect(texts(events)).toEqual(['Partial answer']);
      expect(end(events)).toEqual({ type: 'end', outcome: 'cut_short', reason: 'stalled' });
      expect(elapsed).toBeLessThan(450);
    });
  });

  describe('quick-failure retry', () => {
    it('retries once after a quick service error and succeeds', async () => {
      const { events, fake, logger } = await run({
        replies: [{ kind: 'error', status: 529 }, { kind: 'stream', steps: textReply(['Recovered']) }],
      });

      expect(texts(events)).toEqual(['Recovered']);
      expect(end(events)).toEqual({ type: 'end', outcome: 'complete' });
      expect(fake.calls).toHaveLength(2);
      expect(logger.records[0]).toMatchObject({ attempts: 2, outcome: 'complete' });
    });

    it('retries once after a network failure', async () => {
      const { events } = await run({
        replies: [{ kind: 'network' }, { kind: 'stream', steps: textReply(['Recovered']) }],
      });

      expect(end(events)).toEqual({ type: 'end', outcome: 'complete' });
    });

    it('retries at most once', async () => {
      const { events, fake } = await run({
        replies: [
          { kind: 'error', status: 529 },
          { kind: 'error', status: 529 },
          { kind: 'stream', steps: textReply(['Too late']) },
        ],
      });

      expect(end(events)).toEqual({ type: 'end', outcome: 'failed', reason: 'unavailable' });
      expect(fake.calls).toHaveLength(2);
    });

    it.each([
      [401, 'auth'],
      [400, 'bad_request'],
      [429, 'rate_limited'],
    ] as const)('does not retry a %i (%s)', async (status, reason) => {
      const { events, fake } = await run({ replies: [{ kind: 'error', status }] });

      expect(end(events)).toEqual({ type: 'end', outcome: 'failed', reason });
      expect(fake.calls).toHaveLength(1);
    });

    it('does not retry when too little of the first-word budget is left', async () => {
      const { events, fake } = await run({ replies: [{ kind: 'error', status: 500, delayMs: 250 }] });

      expect(end(events)).toEqual({ type: 'end', outcome: 'failed', reason: 'unavailable' });
      expect(fake.calls).toHaveLength(1);
    });

    it('keeps the retry inside the same first-word budget', async () => {
      const { events, fake, elapsed } = await run({
        replies: [
          { kind: 'error', status: 500, delayMs: 100 },
          { kind: 'stream', steps: [messageStart(), hang()] },
        ],
      });

      expect(fake.calls).toHaveLength(2);
      expect(end(events)).toMatchObject({ outcome: 'failed', reason: 'first_token_timeout' });
      expect(elapsed).toBeLessThan(450); // ~300ms total, not 100 + 300
    });
  });

  describe('client goes away', () => {
    it('cancels the AI call before the first word', async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);

      const { events, fake, elapsed } = await run({
        signal: controller.signal,
        replies: [{ kind: 'stream', steps: [messageStart(), hang()] }],
      });

      expect(end(events)).toEqual({ type: 'end', outcome: 'failed', reason: 'cancelled' });
      expect(fake.calls[0]!.signal?.aborted).toBe(true);
      expect(elapsed).toBeLessThan(250);
    });

    it('cancels the AI call partway through a reply', async () => {
      const controller = new AbortController();
      const steps = [...textReply(['Some text']).slice(0, 3), delay(60), hang()];
      setTimeout(() => controller.abort(), 30);

      const { events } = await run({ signal: controller.signal, replies: [{ kind: 'stream', steps }] });

      expect(end(events)).toEqual({ type: 'end', outcome: 'cut_short', reason: 'cancelled' });
    });

    it('does not start at all if the client is already gone', async () => {
      const controller = new AbortController();
      controller.abort();

      const { events, fake } = await run({ signal: controller.signal });

      expect(end(events)).toMatchObject({ outcome: 'failed', reason: 'cancelled' });
      expect(fake.calls).toHaveLength(0);
    });
  });

  describe('never throws', () => {
    it('reports a missing API key as not configured, without retrying', async () => {
      let attempts = 0;
      const { events } = await run({
        start: () => {
          attempts += 1;
          throw new AiNotConfiguredError();
        },
      });

      expect(end(events)).toEqual({ type: 'end', outcome: 'failed', reason: 'not_configured' });
      expect(attempts).toBe(1);
    });

    it('turns a strange error into a clean failure', async () => {
      const { events, logger } = await run({ start: () => Promise.reject('boom') });

      expect(end(events)).toEqual({ type: 'end', outcome: 'failed', reason: 'unknown' });
      expect(logger.records[0]).toMatchObject({ outcome: 'failed', inputTokens: 0, outputTokens: 0, costUsd: 0 });
    });
  });
});
