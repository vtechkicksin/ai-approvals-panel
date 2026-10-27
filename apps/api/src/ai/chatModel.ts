import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { AiConfig } from './config';

export interface ChatModelOptions {
  apiKey: string | undefined;
  config: AiConfig;
}

/** Builds the LangChain Gemini model. Throws AiNotConfiguredError when there is no API key. */
export function createChatModel(_options: ChatModelOptions): ChatGoogleGenerativeAI {
  throw new Error('Not implemented');
}
