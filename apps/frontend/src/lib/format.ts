import type { ApprovalType, PriorityLevel } from '@approvals/schemas';

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2026-09-18T09:15:00.000Z" → "Sep 18" */
export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso));
}

export const TYPE_LABELS: Record<ApprovalType, string> = {
  folder: 'Folder',
  video: 'Video',
  pdf: 'PDF',
  image: 'Image',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function pluralItems(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}
