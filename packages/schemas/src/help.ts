import { z } from 'zod';
import { languageSchema, textStreamEventSchema } from './stream';

export const HELP_LIMITS = { question: 500, excerpt: 240 } as const;

export const helpRequestSchema = z.object({
  language: languageSchema,
  question: z.string().trim().min(1).max(HELP_LIMITS.question),
});
export type HelpRequest = z.infer<typeof helpRequestSchema>;

/** A policy section the answer is based on. */
export const policyCitationSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  excerpt: z.string().min(1).max(HELP_LIMITS.excerpt),
});
export type PolicyCitation = z.infer<typeof policyCitationSchema>;

/**
 * "Help me" streams the same events as a text answer, plus one `citations`
 * event (the policy sections found by search) before the first token.
 */
export const helpStreamEventSchema = z.discriminatedUnion('type', [
  ...textStreamEventSchema.options,
  z.object({ type: z.literal('citations'), items: z.array(policyCitationSchema).min(1) }),
]);
export type HelpStreamEvent = z.infer<typeof helpStreamEventSchema>;
