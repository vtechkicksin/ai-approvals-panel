/**
 * Learning tests: what LangChain's ChatGoogleGenerativeAI really does, run
 * against the fake Gemini API (real LangChain + Google SDK code, no network).
 *
 * Our design needs:
 *  1. Text arrives piece by piece (first piece before the reply is finished).
 *  2. Function-call arguments: Gemini sends them WHOLE, not in pieces, so the
 *     Summary streams JSON as text (JSON mode) rather than as a tool call.
 *  3. An AbortSignal cancels the HTTP call. LangChain then ENDS THE STREAM
 *     QUIETLY instead of throwing, which is why guardedStream races every step
 *     against its own abort signal instead of waiting for an error.
 *  4. Token usage is reported (for cost logging).
 *  5. With maxRetries: 0, HTTP errors surface once with their status, and a
 *     network failure surfaces as a GoogleGenerativeAIError without a status.
 */
import { GoogleGenerativeAIError, GoogleGenerativeAIFetchError } from '@google/generative-ai';
import type { AIMessageChunk } from '@langchain/core/messages';
import { emptyChunk, functionCallReply, hang, textPieces, textReply } from '../helpers/fakeGemini';
import { fakeModel } from '../helpers/aiTestKit';

async function collect(stream: AsyncIterable<AIMessageChunk>) {
  const chunks: { chunk: AIMessageChunk; at: number }[] = [];
  const start = Date.now();
  for await (const chunk of stream) chunks.push({ chunk, at: Date.now() - start });
  return chunks;
}

async function errorFrom(run: () => Promise<unknown>): Promise<unknown> {
  return run().then(
    () => undefined,
    (err: unknown) => err,
  );
}

describe('LangChain ChatGoogleGenerativeAI behaviour we rely on', () => {
  it('1. streams text piece by piece, before the reply is finished', async () => {
    const { model } = fakeModel({ kind: 'stream', steps: textReply(['Four ', 'approvals ', 'are waiting.'], { gapMs: 80 }) });

    const chunks = (await collect(await model.stream('Greet me'))).filter(({ chunk }) => chunk.text.length > 0);

    expect(chunks.map(({ chunk }) => chunk.text)).toEqual(['Four ', 'approvals ', 'are waiting.']);
    expect(chunks[2]!.at - chunks[0]!.at).toBeGreaterThanOrEqual(120);
  });

  it('2. delivers function-call arguments whole, in one chunk', async () => {
    const { model } = fakeModel({ kind: 'stream', steps: functionCallReply('emit_summary', { headline: '4 waiting' }) });
    const withTool = model.bindTools([
      { name: 'emit_summary', description: 'Emit the summary', schema: { type: 'object', properties: {} } },
    ]);

    const chunks = await collect(await withTool.stream('Summarise'));
    const argPieces = chunks.flatMap(({ chunk }) => chunk.tool_call_chunks ?? []).map((t) => t.args ?? '');

    expect(argPieces).toHaveLength(1);
    expect(JSON.parse(argPieces[0]!)).toEqual({ headline: '4 waiting' });
  });

  it('3a. an AbortSignal cancels a call waiting for its first piece; the stream ends quietly', async () => {
    const { model, fake } = fakeModel({ kind: 'stream', steps: [emptyChunk(), hang()] });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const started = Date.now();
    const error = await errorFrom(async () => collect(await model.stream('Hello', { signal: controller.signal })));

    expect(Date.now() - started).toBeLessThan(1000);
    expect(fake.calls[0]!.signal?.aborted).toBe(true); // the HTTP request itself was cancelled
    // Either outcome is possible across versions; we must not depend on an error being thrown.
    expect(error === undefined || (error as Error).name.includes('Abort')).toBe(true);
  });

  it('3b. an AbortSignal stops a reply partway, keeping what arrived', async () => {
    const { model } = fakeModel({ kind: 'stream', steps: [...textPieces(['Partial ']), hang()] });
    const controller = new AbortController();
    const received: string[] = [];

    await errorFrom(async () => {
      for await (const chunk of await model.stream('Hello', { signal: controller.signal })) {
        if (chunk.text) {
          received.push(chunk.text);
          setTimeout(() => controller.abort(), 50);
        }
      }
    });

    expect(received).toEqual(['Partial ']);
  });

  it('4. reports token usage for cost logging', async () => {
    const { model } = fakeModel({ kind: 'stream', steps: textReply(['Hi', ' there']) });

    const chunks = await collect(await model.stream('Hello'));
    const total = (key: 'input_tokens' | 'output_tokens') =>
      chunks.reduce((sum, { chunk }) => sum + (chunk.usage_metadata?.[key] ?? 0), 0);

    expect(total('input_tokens')).toBe(12);
    expect(total('output_tokens')).toBe(2);
  });

  it.each([
    [400, 'bad request'],
    [403, 'bad API key'],
    [429, 'free-tier quota'],
    [503, 'service overloaded'],
  ])('5a. with maxRetries: 0, a %i (%s) fails once with its status', async (status) => {
    const { model, fake } = fakeModel({ kind: 'error', status });

    const error = await errorFrom(async () => collect(await model.stream('Hello')));

    expect(error).toBeInstanceOf(GoogleGenerativeAIFetchError);
    expect((error as GoogleGenerativeAIFetchError).status).toBe(status);
    expect(fake.calls).toHaveLength(1); // no retry behind our back
  });

  it('5b. a network failure surfaces as a GoogleGenerativeAIError without a status', async () => {
    const { model } = fakeModel({ kind: 'network' });

    const error = await errorFrom(async () => collect(await model.stream('Hello')));

    expect(error).toBeInstanceOf(GoogleGenerativeAIError);
    expect(error).not.toBeInstanceOf(GoogleGenerativeAIFetchError);
  });
});
