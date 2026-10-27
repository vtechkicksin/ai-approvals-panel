import { z } from 'zod';
import { approvalTypeSchema, priorityLevelSchema } from './approvals';
import { answerSourceSchema, languageSchema, noticeCodeSchema } from './stream';

/** Length limits for AI-written text. Longer text is cut while streaming and rejected at the end. */
export const SUMMARY_LIMITS = { headline: 200, reason: 300, spokenScript: 800 } as const;

export const summaryRequestSchema = z.object({
  language: languageSchema,
});
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

/** One queue item as shown on a summary card before any AI text arrives. */
export const summaryCardSchema = z.object({
  id: z.string().min(1),
  rank: z.number().int().positive(),
  title: z.string().min(1),
  type: approvalTypeSchema,
  effectivePriority: priorityLevelSchema,
  priorityReason: z.string().min(1),
});
export type SummaryCard = z.infer<typeof summaryCardSchema>;

/** The final, validated summary. Items are always in the queue's ranked order. */
export const summarySchema = z.object({
  headline: z.string().trim().min(1).max(SUMMARY_LIMITS.headline),
  items: z.array(
    z.object({
      id: z.string().min(1),
      reason: z.string().trim().min(1).max(SUMMARY_LIMITS.reason),
    }),
  ),
  spokenScript: z.string().trim().min(1).max(SUMMARY_LIMITS.spokenScript),
});
export type Summary = z.infer<typeof summarySchema>;

/**
 * Server-Sent Events for "Present me Summary":
 * skeleton (rule-ranked cards, instantly) → delta* / item* (AI text as it
 * streams) → notice? → complete (the validated final summary) | error.
 * Streamed text is provisional until `complete` arrives.
 */
export const summaryStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('skeleton'), items: z.array(summaryCardSchema), total: z.number().int().nonnegative() }),
  z
    .object({
      type: z.literal('delta'),
      field: z.enum(['headline', 'reason', 'spokenScript']),
      itemId: z.string().min(1).optional(),
      text: z.string().min(1),
    })
    .refine((e) => (e.field === 'reason') === (e.itemId !== undefined), {
      message: 'itemId is required for reason deltas and only for them',
    }),
  z.object({
    type: z.literal('item'),
    itemId: z.string().min(1),
    status: z.enum(['ok', 'fallback']),
    reason: z.string().min(1),
  }),
  z.object({ type: z.literal('notice'), code: noticeCodeSchema, message: z.string().min(1) }),
  z.object({ type: z.literal('complete'), source: answerSourceSchema, summary: summarySchema }),
  z.object({ type: z.literal('error'), code: z.string().min(1), message: z.string().min(1) }),
]);
export type SummaryStreamEvent = z.infer<typeof summaryStreamEventSchema>;
