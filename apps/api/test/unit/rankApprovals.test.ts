import type { ApprovalItem } from '@approvals/schemas';
import { rankApprovals } from '../../src/features/approvals/rankApprovals';
import type { PriorityTable } from '../../src/policy/priorityTable';

const table: PriorityTable = new Map([
  ['safety', { priority: 'high', reason: 'Protects people on site.' }],
  ['onboarding', { priority: 'medium', reason: 'Blocks new staff.' }],
  ['mapping', { priority: 'low', reason: 'Can wait.' }],
]);

function item(overrides: Partial<ApprovalItem> & Pick<ApprovalItem, 'id'>): ApprovalItem {
  return {
    title: `Item ${overrides.id}`,
    type: 'pdf',
    submittedBy: 'Sam HelpAdmin',
    submittedAt: '2026-09-18T09:00:00.000Z',
    status: 'pending_review',
    location: ['Site Recordings'],
    category: 'onboarding',
    ...overrides,
  };
}

describe('rankApprovals', () => {
  it('uses the policy table to set each item\'s priority', () => {
    const [ranked] = rankApprovals([item({ id: 'a', category: 'safety' })], table);

    expect(ranked).toMatchObject({
      effectivePriority: 'high',
      prioritySource: 'policy',
      priorityReason: 'Protects people on site.',
    });
  });

  it('lets the item\'s own priority override the policy', () => {
    const [ranked] = rankApprovals([item({ id: 'a', category: 'mapping', priority: 'urgent' })], table);

    expect(ranked).toMatchObject({ effectivePriority: 'urgent', prioritySource: 'item_override' });
    expect(ranked?.priorityReason).toMatch(/urgent/i);
  });

  it('can also lower a priority through the item override', () => {
    const [ranked] = rankApprovals([item({ id: 'a', category: 'safety', priority: 'low' })], table);

    expect(ranked).toMatchObject({ effectivePriority: 'low', prioritySource: 'item_override' });
  });

  it('falls back to medium when the category is not in the policy', () => {
    const [ranked] = rankApprovals([item({ id: 'a', category: 'unknown-thing' })], table);

    expect(ranked).toMatchObject({ effectivePriority: 'medium', prioritySource: 'default' });
    expect(ranked?.priorityReason).toMatch(/not listed/i);
  });

  it('matches categories without caring about case', () => {
    const [ranked] = rankApprovals([item({ id: 'a', category: 'Safety' })], table);

    expect(ranked?.prioritySource).toBe('policy');
  });

  it('orders urgent → high → medium → low and numbers ranks from 1', () => {
    const ranked = rankApprovals(
      [
        item({ id: 'low', category: 'mapping' }),
        item({ id: 'medium', category: 'onboarding' }),
        item({ id: 'urgent', category: 'onboarding', priority: 'urgent' }),
        item({ id: 'high', category: 'safety' }),
      ],
      table,
    );

    expect(ranked.map((r) => r.id)).toEqual(['urgent', 'high', 'medium', 'low']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('puts the oldest first when priorities are equal', () => {
    const ranked = rankApprovals(
      [
        item({ id: 'newer', submittedAt: '2026-09-18T12:00:00.000Z' }),
        item({ id: 'older', submittedAt: '2026-09-17T08:00:00.000Z' }),
      ],
      table,
    );

    expect(ranked.map((r) => r.id)).toEqual(['older', 'newer']);
  });

  it('breaks a full tie by title so the order is always the same', () => {
    const ranked = rankApprovals([item({ id: '1', title: 'Beta' }), item({ id: '2', title: 'Alpha' })], table);

    expect(ranked.map((r) => r.title)).toEqual(['Alpha', 'Beta']);
  });

  it('does not change the input list', () => {
    const input = [item({ id: 'low', category: 'mapping' }), item({ id: 'high', category: 'safety' })];
    const before = structuredClone(input);

    rankApprovals(input, table);

    expect(input).toEqual(before);
  });

  it('returns an empty list for an empty queue', () => {
    expect(rankApprovals([], table)).toEqual([]);
  });
});
