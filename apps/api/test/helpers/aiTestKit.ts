import type { AiConfig } from '../../src/ai/config';
import { createChatModel } from '../../src/ai/chatModel';
import { createFakeAnthropic, type FakeReply } from './fakeAnthropic';

/** Short timeouts so failure paths run in milliseconds, not seconds. */
export const testAiConfig: AiConfig = {
  model: 'claude-haiku-5-5',
  firstTokenTimeoutMs: 300,
  idleTimeoutMs: 150,
  minRetryWindowMs: 100,
  maxTokens: 512,
};

/** A real LangChain model wired to a fake Anthropic HTTP layer. */
export function fakeModel(...replies: FakeReply[]) {
  const fake = createFakeAnthropic(...replies);
  const model = createChatModel({ apiKey: 'test-key', config: testAiConfig, fetch: fake.fetch });
  return { model, fake };
}
