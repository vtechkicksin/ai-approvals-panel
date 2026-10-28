import type { SummaryCard } from '@approvals/schemas';

/** The seed queue as summary cards, in ranked order. */
export const seedCards: SummaryCard[] = [
  {
    id: 'apr-004',
    rank: 1,
    title: '360° Spatial Zone Layout & Camera Map',
    type: 'image',
    effectivePriority: 'urgent',
    priorityReason: 'Marked urgent by the submitter, which overrides the policy.',
  },
  {
    id: 'apr-003',
    rank: 2,
    title: 'Safety Equipment & Sensor Specs',
    type: 'pdf',
    effectivePriority: 'high',
    priorityReason: 'Safety equipment and sensor specs protect people on site.',
  },
  {
    id: 'apr-001',
    rank: 3,
    title: 'Site Patrol Onboarding & Checklists',
    type: 'folder',
    effectivePriority: 'medium',
    priorityReason: 'New patrol staff cannot start until their checklists are approved.',
  },
  {
    id: 'apr-002',
    rank: 4,
    title: 'Level 2 Drone Patrol Video Demo',
    type: 'video',
    effectivePriority: 'medium',
    priorityReason: 'Training videos guide patrols but do not block daily work.',
  },
];

/** A good model reply for the seed queue. */
export const goodSummaryJson = {
  headline: 'Four approvals are waiting; start with the urgent camera map.',
  items: [
    { id: 'apr-004', reason: 'Marked urgent by the submitter, so review it before anything else.' },
    { id: 'apr-003', reason: 'Safety specs protect people on site; check the sensor details next.' },
    { id: 'apr-001', reason: 'New patrol staff are waiting on these checklists.' },
    { id: 'apr-002', reason: 'A training video that can wait until the rest is done.' },
  ],
  spokenScript: 'You have four approvals waiting. Start with the urgent camera map, then the safety specs.',
};

/** Splits text into pieces of `size` characters, like a streaming model reply. */
export function chunkText(text: string, size: number): string[] {
  const pieces: string[] = [];
  for (let i = 0; i < text.length; i += size) pieces.push(text.slice(i, i + size));
  return pieces;
}
