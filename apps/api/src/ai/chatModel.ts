import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { AiConfig } from './config';
import { AiNotConfiguredError } from './errors';
import { applyGeminiSdkPatch } from './geminiSdkPatch';

applyGeminiSdkPatch();

export interface ChatModelOptions {
  apiKey: string | undefined;
  config: AiConfig;
}

/** Builds the LangChain Gemini model. Throws AiNotConfiguredError when there is no API key. */
export function createChatModel({ apiKey, config }: ChatModelOptions): ChatGoogleGenerativeAI {
  if (!apiKey) throw new AiNotConfiguredError();

  return new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey,
    maxOutputTokens: config.maxTokens,
    // Short operator answers: skip thinking so the first word arrives fast
    // (measured ~1.4s on gemini-2.5-flash, vs. hundreds of thinking tokens first).
    thinkingConfig: { thinkingBudget: 0 },
    // Our guardedStream owns retries, so it can keep them inside the first-word budget.
    maxRetries: 0,
    streamUsage: true,
  });
}
