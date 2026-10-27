import { ChatAnthropic } from '@langchain/anthropic';
import type { AiConfig } from './config';
import { AiNotConfiguredError } from './errors';

export interface ChatModelOptions {
  apiKey: string | undefined;
  config: AiConfig;
  /** Tests inject a fake HTTP layer here. */
  fetch?: typeof fetch;
}

/** Builds the LangChain Claude model. Throws AiNotConfiguredError when there is no API key. */
export function createChatModel({ apiKey, config, fetch }: ChatModelOptions): ChatAnthropic {
  if (!apiKey) throw new AiNotConfiguredError();

  return new ChatAnthropic({
    model: config.model,
    apiKey,
    maxTokens: config.maxTokens,
    // Short operator answers: skip thinking so the first word arrives fast.
    thinking: { type: 'disabled' },
    // Our guardedStream owns retries, so it can keep them inside the first-word budget.
    maxRetries: 0,
    streamUsage: true,
    clientOptions: fetch ? { fetch } : {},
  });
}
