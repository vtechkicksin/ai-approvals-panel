import type { BaseMessage } from '@langchain/core/messages';
import type { ChatMessage } from '@approvals/schemas';

/** How many recent messages the model sees. Older ones are dropped. */
export const HISTORY_LIMIT = 12;

/**
 * Turns the chat history into model messages: keeps the most recent ones,
 * starts on a user message, and merges back-to-back messages from the same
 * side (Gemini requires turns to alternate).
 */
export function toModelMessages(_messages: readonly ChatMessage[], _limit = HISTORY_LIMIT): BaseMessage[] {
  throw new Error('Not implemented');
}
