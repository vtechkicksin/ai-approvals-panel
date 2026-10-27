import type { ChatAnthropic } from '@langchain/anthropic';
import type { AiConfig } from './config';

export interface ChatModelOptions {
  apiKey: string | undefined;
  config: AiConfig;
  /** Tests inject a fake HTTP layer here. */
  fetch?: typeof fetch;
}

/** Builds the LangChain Claude model. Throws AiNotConfiguredError when there is no API key. */
export function createChatModel(_options: ChatModelOptions): ChatAnthropic {
  throw new Error('Not implemented');
}
