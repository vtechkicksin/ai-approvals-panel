import type { AiConfig } from '../../src/ai/config';
import { createChatModel } from '../../src/ai/chatModel';
import { installFakeGemini, type FakeGemini, type FakeReply } from './fakeGemini';

/** Short timeouts so failure paths run in milliseconds, not seconds. */
export const testAiConfig: AiConfig = {
  model: 'gemini-3.1-flash-lite',
  firstTokenTimeoutMs: 300,
  idleTimeoutMs: 150,
  minRetryWindowMs: 100,
  maxTokens: 512,
  pricePerMTok: { input: 0.3, output: 2.5 },
  rateLimitPerMinute: 20,
  rateLimitPerIpPerMinute: 60,
};

const installed: FakeGemini[] = [];
afterEach(() => installed.splice(0).forEach((fake) => fake.restore()));

/** A real LangChain Gemini model, talking to the fake Gemini API. */
export function fakeModel(...replies: FakeReply[]) {
  const fake = installFakeGemini(...replies);
  installed.push(fake);
  const model = createChatModel({ apiKey: 'test-key', config: testAiConfig });
  return { model, fake };
}
