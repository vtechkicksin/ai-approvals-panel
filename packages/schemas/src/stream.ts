import { z } from 'zod';

export const languageSchema = z.enum(['en', 'hi']);
export type Language = z.infer<typeof languageSchema>;

/** Friendly status messages shown in the panel when the AI is not at its best. */
export const noticeCodeSchema = z.enum(['ai_slow', 'ai_unavailable', 'cut_short', 'rate_limited']);
export type NoticeCode = z.infer<typeof noticeCodeSchema>;

/** Where the final answer came from. */
export const answerSourceSchema = z.enum(['ai', 'partial', 'fallback']);
export type AnswerSource = z.infer<typeof answerSourceSchema>;

/**
 * Server-Sent Events for a streamed text answer. Every stream ends with
 * exactly one `done` (or `error`) event.
 */
export const textStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string().min(1) }),
  z.object({ type: z.literal('notice'), code: noticeCodeSchema, message: z.string().min(1) }),
  z.object({ type: z.literal('fallback'), text: z.string().min(1) }),
  z.object({ type: z.literal('done'), source: answerSourceSchema }),
  z.object({ type: z.literal('error'), code: z.string().min(1), message: z.string().min(1) }),
]);
export type TextStreamEvent = z.infer<typeof textStreamEventSchema>;
