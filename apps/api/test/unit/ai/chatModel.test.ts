import { AiNotConfiguredError } from '../../../src/ai/errors';
import { createChatModel } from '../../../src/ai/chatModel';
import { textReply } from '../../helpers/fakeGemini';
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

    expect(fake.calls[0]!.url).toContain('/models/gemini-2.5-flash:streamGenerateContent');
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
});
