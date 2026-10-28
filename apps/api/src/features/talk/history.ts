import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
import type { ChatMessage } from '@approvals/schemas';

/** How many recent messages the model sees. Older ones are dropped. */
export const HISTORY_LIMIT = 12;

/**
 * Turns the chat history into model messages: keeps the most recent ones,
 * starts on a user message, and merges back-to-back messages from the same
 * side (Gemini requires turns to alternate).
 */
export function toModelMessages(messages: readonly ChatMessage[], limit = HISTORY_LIMIT): BaseMessage[] {
  const merged: ChatMessage[] = [];
  for (const message of messages) {
    const last = merged.at(-1);
    if (last?.role === message.role) last.content = `${last.content}\n\n${message.content}`;
    else merged.push({ ...message });
  }

  let recent = merged.slice(-limit);
  while (recent.length > 0 && recent[0]!.role !== 'user') recent = recent.slice(1);

  return recent.map((m) => (m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)));
}
