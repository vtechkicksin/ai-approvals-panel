import { z } from 'zod';

export const PRIORITY_LEVELS = ['urgent', 'high', 'medium', 'low'] as const;
export const priorityLevelSchema = z.enum(PRIORITY_LEVELS);
export type PriorityLevel = z.infer<typeof priorityLevelSchema>;

export const approvalTypeSchema = z.enum(['folder', 'video', 'pdf', 'image']);
export type ApprovalType = z.infer<typeof approvalTypeSchema>;


export const approvalItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: approvalTypeSchema,
  submittedBy: z.string().min(1),
  submittedAt: z.iso.datetime(),
  status: z.literal('pending_review'),
  location: z.array(z.string().min(1)).min(1),
  category: z.string().min(1),
  priority: priorityLevelSchema.optional(),
});
export type ApprovalItem = z.infer<typeof approvalItemSchema>;

export const prioritySourceSchema = z.enum(['item_override', 'policy', 'default']);
export type PrioritySource = z.infer<typeof prioritySourceSchema>;

export const rankedApprovalSchema = approvalItemSchema.extend({
  rank: z.number().int().positive(),
  effectivePriority: priorityLevelSchema,
  prioritySource: prioritySourceSchema,
  priorityReason: z.string().min(1),
});
export type RankedApproval = z.infer<typeof rankedApprovalSchema>;

export const approvalsResponseSchema = z.object({
  items: z.array(rankedApprovalSchema),
  total: z.number().int().nonnegative(),
});
export type ApprovalsResponse = z.infer<typeof approvalsResponseSchema>;
