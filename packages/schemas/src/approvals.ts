import { z } from 'zod';

/** Highest first. The order of this list is the ranking order. */
export const PRIORITY_LEVELS = ['urgent', 'high', 'medium', 'low'] as const;
export const priorityLevelSchema = z.enum(PRIORITY_LEVELS);
export type PriorityLevel = z.infer<typeof priorityLevelSchema>;

export const approvalTypeSchema = z.enum(['folder', 'video', 'pdf', 'image']);
export type ApprovalType = z.infer<typeof approvalTypeSchema>;

/** One item in the approvals queue, as stored in the seed data. */
export const approvalItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: approvalTypeSchema,
  submittedBy: z.string().min(1),
  submittedAt: z.iso.datetime(),
  status: z.literal('pending_review'),
  /** Breadcrumb shown under the title, e.g. ["My Site Patrol", "My Site Patrol Card"]. */
  location: z.array(z.string().min(1)).min(1),
  /** Looked up in the policy's priority table to get the default priority. */
  category: z.string().min(1),
  /** Set by the submitter. When present it overrides the policy default. */
  priority: priorityLevelSchema.optional(),
});
export type ApprovalItem = z.infer<typeof approvalItemSchema>;

/** Where an item's final priority came from. */
export const prioritySourceSchema = z.enum(['item_override', 'policy', 'default']);
export type PrioritySource = z.infer<typeof prioritySourceSchema>;

export const rankedApprovalSchema = approvalItemSchema.extend({
  /** 1 = review first. */
  rank: z.number().int().positive(),
  effectivePriority: priorityLevelSchema,
  prioritySource: prioritySourceSchema,
  /** Plain-English reason for the priority, shown to the operator. */
  priorityReason: z.string().min(1),
});
export type RankedApproval = z.infer<typeof rankedApprovalSchema>;

export const approvalsResponseSchema = z.object({
  items: z.array(rankedApprovalSchema),
  total: z.number().int().nonnegative(),
});
export type ApprovalsResponse = z.infer<typeof approvalsResponseSchema>;
