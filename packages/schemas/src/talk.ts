import { z } from 'zod';
import { languageSchema } from './stream';

export const TALK_LIMITS = {
  /** Longest message an operator can send. */
  userMessage: 1000,
  /** Longest earlier assistant reply we accept back in the history. */
  assistantMessage: 4000,
  /** Most messages one request may carry. */
  maxMessages: 30,
} as const;

export const chatMessageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('user'), content: z.string().trim().min(1).max(TALK_LIMITS.userMessage) }),
  z.object({ role: z.literal('assistant'), content: z.string().trim().min(1).max(TALK_LIMITS.assistantMessage) }),
]);
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * "Talk to me": the conversation so far, ending with the operator's new
 * message. The reply streams back as text events (see textStreamEventSchema).
 */
export const talkRequestSchema = z.object({
  language: languageSchema,
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(TALK_LIMITS.maxMessages)
    .refine((messages) => messages.at(-1)?.role === 'user', { message: 'The last message must be from the user' }),
});
export type TalkRequest = z.infer<typeof talkRequestSchema>;
