import { z } from 'zod';
import { languageSchema } from './stream';
import { chatMessageSchema } from './talk';

export const teachStepSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(1),
});
export type TeachStep = z.infer<typeof teachStepSchema>;

/** The fixed review guide, taken from the policy. No AI involved. */
export const teachGuideSchema = z.object({
  steps: z.array(teachStepSchema).min(1),
  /** The policy section the steps come from, or null for the built-in guide. */
  sourceSectionId: z.string().min(1).nullable(),
});
export type TeachGuide = z.infer<typeof teachGuideSchema>;

/**
 * A follow-up question about one step of the guide, with the earlier
 * questions and answers about that same step. Streams back as text events.
 */
export const teachRequestSchema = z.object({
  language: languageSchema,
  step: z.number().int().positive(),
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(12)
    .refine((messages) => messages.at(-1)?.role === 'user', { message: 'The last message must be from the user' }),
});
export type TeachRequest = z.infer<typeof teachRequestSchema>;
