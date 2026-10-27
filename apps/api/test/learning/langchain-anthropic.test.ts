/**
 * Learning tests: prove LangChain's ChatAnthropic gives us what our design
 * depends on, before we build on it. They run the real LangChain + Anthropic
 * SDK code against a fake HTTP layer (no network, no API key).
 *
 * Our design needs:
 *  1. Text arrives piece by piece (first piece before the reply is finished).
 *  2. Tool-call JSON arguments arrive piece by piece (for the Summary slots).
 *  3. An AbortSignal stops the call, even while waiting for the first piece
 *     (this is how we enforce the 8s first-token and 5s silence limits).
 *  4. Token usage is reported (for cost logging).
 *  5. With maxRetries: 0, errors surface once with their HTTP status, so our
 *     own code decides what to retry.
 */
import { ChatAnthropic } from '@langchain/anthropic';
import type { AIMessageChunk } from '@langchain/core/messages';
import { createFakeAnthropic, delay, hang, messageStart, textReply, toolUseReply, type FakeReply } from '../helpers/fakeAnthropic';

function modelWith(...replies: FakeReply[]) {
  const fake = createFakeAnthropic(...replies);
  const model = new ChatAnthropic({
    model: 'claude-haiku-5-5',
    apiKey: 'test-key',
    maxRetries: 0,
    streamUsage: true,
    clientOptions: { fetch: fake.fetch },
  });
  return { model, fake };
}

async function collect(stream: AsyncIterable<AIMessageChunk>) {
  const chunks: { chunk: AIMessageChunk; at: number }[] = [];
  const start = Date.now();
  for await (const chunk of stream) chunks.push({ chunk, at: Date.now() - start });
  return chunks;
}

const textOf = (c: AIMessageChunk) => (typeof c.content === 'string' ? c.content : c.text);

describe('LangChain ChatAnthropic capabilities we rely on', () => {
  it('1. streams text piece by piece, before the reply is finished', async () => {
    const { model } = modelWith({ kind: 'stream', steps: textReply(['Four ', 'approvals ', 'are waiting.'], { gapMs: 80 }) });

    const chunks = await collect(await model.stream('Greet me'));
    const withText = chunks.filter(({ chunk }) => textOf(chunk).length > 0);

    expect(withText.map(({ chunk }) => textOf(chunk))).toEqual(['Four ', 'approvals ', 'are waiting.']);
    // The first piece arrived well before the last one: real streaming, not a buffered dump.
    expect(withText[2]!.at - withText[0]!.at).toBeGreaterThanOrEqual(120);
  });

  it('2. streams tool-call JSON arguments piece by piece', async () => {
    const pieces = ['{"headline":"4 app', 'rovals waiting","items":[{"id":"a', '1","reason":"Safety first"}]}'];
    const { model } = modelWith({ kind: 'stream', steps: toolUseReply('emit_summary', pieces) });
    const withTool = model.bindTools([
      { name: 'emit_summary', description: 'Emit the summary', input_schema: { type: 'object', properties: {} } },
    ]);

    const chunks = await collect(await withTool.stream('Summarise'));
    const argPieces = chunks.flatMap(({ chunk }) => chunk.tool_call_chunks ?? []).map((t) => t.args ?? '').filter(Boolean);

    expect(argPieces).toEqual(pieces);
    expect(JSON.parse(argPieces.join(''))).toEqual({
      headline: '4 approvals waiting',
      items: [{ id: 'a1', reason: 'Safety first' }],
    });
  });

  it('3a. an AbortSignal stops a call that never sends its first piece', async () => {
    const { model, fake } = modelWith({ kind: 'stream', steps: [messageStart(), hang()] });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const started = Date.now();
    await expect(collect(await model.stream('Hello', { signal: controller.signal }))).rejects.toThrow(/abort/i);

    expect(Date.now() - started).toBeLessThan(1000);
    expect(fake.calls[0]!.signal?.aborted).toBe(true); // the HTTP request itself was cancelled
  });

  it('3b. an AbortSignal stops a reply that goes silent partway', async () => {
    const steps = textReply(['Partial ', 'answer']).slice(0, 3); // start + first text piece only
    const { model } = modelWith({ kind: 'stream', steps: [...steps, delay(10), hang()] });
    const controller = new AbortController();

    const received: string[] = [];
    const run = async () => {
      for await (const chunk of await model.stream('Hello', { signal: controller.signal })) {
        if (textOf(chunk)) {
          received.push(textOf(chunk));
          setTimeout(() => controller.abort(), 50);
        }
      }
    };

    await expect(run()).rejects.toThrow(/abort/i);
    expect(received).toEqual(['Partial ']); // what arrived before the silence is kept
  });

  it('4. reports token usage for cost logging', async () => {
    const { model } = modelWith({ kind: 'stream', steps: textReply(['Hi']) });

    const chunks = await collect(await model.stream('Hello'));
    const usage = chunks.map(({ chunk }) => chunk.usage_metadata).filter(Boolean);
    const inputTokens = usage.reduce((sum, u) => sum + (u?.input_tokens ?? 0), 0);
    const outputTokens = usage.reduce((sum, u) => sum + (u?.output_tokens ?? 0), 0);

    expect(inputTokens).toBe(12);
    expect(outputTokens).toBeGreaterThan(0);
  });

  it.each([
    [401, 'bad API key'],
    [529, 'service overloaded'],
    [500, 'server error'],
  ])('5. with maxRetries: 0, a %i (%s) fails once and exposes the status', async (status) => {
    const { model, fake } = modelWith({ kind: 'error', status });

    // The error is thrown when the stream opens, before any piece is read.
    const error = await (async () => collect(await model.stream('Hello')))().then(
      () => undefined,
      (err: unknown) => err as { status?: number },
    );

    expect(error?.status).toBe(status);
    expect(fake.calls).toHaveLength(1); // LangChain did not retry behind our back
  });
});
