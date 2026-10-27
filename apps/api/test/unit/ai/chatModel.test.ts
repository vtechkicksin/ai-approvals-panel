import { AiNotConfiguredError } from '../../../src/ai/errors';
import { createChatModel } from '../../../src/ai/chatModel';
import { hang, textPieces, textReply } from '../../helpers/fakeGemini';
import { fakeModel, testAiConfig } from '../../helpers/aiTestKit';

async function drain(stream: AsyncIterable<unknown>) {
  for await (const _ of stream) {
    // consume
  }
}

describe('createChatModel (Gemini)', () => {
  it('refuses to build without an API key, with a clear error type', () => {
    expect(() => createChatModel({ apiKey: undefined, config: testAiConfig })).toThrow(AiNotConfiguredError);
    expect(() => createChatModel({ apiKey: '', config: testAiConfig })).toThrow(AiNotConfiguredError);
  });

  it('streams from the configured model', async () => {
    const { model, fake } = fakeModel({ kind: 'stream', steps: textReply(['Hi']) });

    await drain(await model.stream('Hello'));

    expect(fake.calls[0]!.url).toContain('/models/gemini-3.1-flash-lite:streamGenerateContent');
    expect(fake.calls[0]!.url).toContain('alt=sse');
  });

  it('sends the API key in a header, never in the URL', async () => {
    const { model, fake } = fakeModel({ kind: 'stream', steps: textReply(['Hi']) });

    await drain(await model.stream('Hello'));

    expect(fake.calls[0]!.headers.get('x-goog-api-key')).toBe('test-key');
    expect(fake.calls[0]!.url).not.toContain('test-key');
  });

  it('turns thinking off and caps the reply length', async () => {
    const { model, fake } = fakeModel({ kind: 'stream', steps: textReply(['Hi']) });

    await drain(await model.stream('Hello'));

    // Thinking off: measured first word ~1.4s instead of several seconds (8s first-word rule).
    expect(fake.calls[0]!.body.generationConfig).toMatchObject({
      maxOutputTokens: 512,
      thinkingConfig: { thinkingBudget: 0 },
    });
  });

  it('leaves retries to our own code (no hidden SDK retries)', async () => {
    const { model, fake } = fakeModel({ kind: 'error', status: 503 });

    await expect((async () => drain(await model.stream('Hello')))()).rejects.toMatchObject({ status: 503 });
    expect(fake.calls).toHaveLength(1);
  });

  it('leaves no unhandled promise rejection when a stream is cancelled (it would crash Node)', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { model } = fakeModel({ kind: 'stream', steps: [...textPieces(['Partial']), hang()] });
      const controller = new AbortController();

      const stream = await model.stream('Hello', { signal: controller.signal });
      const iterator = stream[Symbol.asyncIterator]();
      await iterator.next(); // first piece arrived
      controller.abort(); // user closed the panel
      await iterator.return?.().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('sends requests to the configured base URL', async () => {
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ error: { code: 503, message: 'x', status: 'UNAVAILABLE' } }), { status: 503 });
    }) as typeof fetch;
    try {
      const model = createChatModel({ apiKey: 'k', config: { ...testAiConfig, baseUrl: 'http://localhost:4900' } });
      await (async () => drain(await model.stream('Hi')))().catch(() => {});
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(calls[0]).toMatch(/^http:\/\/localhost:4900\/v1beta\/models\/gemini-3\.1-flash-lite:streamGenerateContent/);
  });
});
