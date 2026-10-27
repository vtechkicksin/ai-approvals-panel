import { AiNotConfiguredError } from '../../../src/ai/errors';
import { createChatModel } from '../../../src/ai/chatModel';
import { createFakeAnthropic, textReply } from '../../helpers/fakeAnthropic';
import { testAiConfig } from '../../helpers/aiTestKit';

async function drain(stream: AsyncIterable<unknown>) {
  for await (const _ of stream) {
    // consume
  }
}

describe('createChatModel', () => {
  it('refuses to build without an API key, with a clear error type', () => {
    expect(() => createChatModel({ apiKey: undefined, config: testAiConfig })).toThrow(AiNotConfiguredError);
    expect(() => createChatModel({ apiKey: '', config: testAiConfig })).toThrow(AiNotConfiguredError);
  });

  it('sends a request the current API accepts', async () => {
    const fake = createFakeAnthropic({ kind: 'stream', steps: textReply(['Hi']) });
    const model = createChatModel({ apiKey: 'test-key', config: testAiConfig, fetch: fake.fetch });

    await drain(await model.stream('Hello'));

    const body = fake.calls[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 512, stream: true });
    // Thinking off: short operator answers should start fast (8s first-word rule).
    expect(body.thinking).toEqual({ type: 'disabled' });
    // Sampling parameters are rejected by the API since 2026-10-21.
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('top_k');
  });

  it('leaves retries to our own code (no hidden SDK retries)', async () => {
    const fake = createFakeAnthropic({ kind: 'error', status: 529 });
    const model = createChatModel({ apiKey: 'test-key', config: testAiConfig, fetch: fake.fetch });

    await expect((async () => drain(await model.stream('Hello')))()).rejects.toMatchObject({ status: 529 });
    expect(fake.calls).toHaveLength(1);
  });
});
