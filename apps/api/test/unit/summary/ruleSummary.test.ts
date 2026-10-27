import { summarySchema, type SummaryCard } from '@approvals/schemas';
import { buildRuleSummary } from '../../../src/summary/ruleSummary';
import { seedCards } from '../../helpers/summaryKit';

describe('buildRuleSummary', () => {
  it('summarises the queue in English, in ranked order, from the policy reasons', () => {
    const summary = buildRuleSummary(seedCards, 'en');

    expect(summarySchema.safeParse(summary).success).toBe(true);
    expect(summary.headline).toMatch(/4 approvals waiting/);
    expect(summary.headline).toMatch(/1 urgent, 1 high, 2 medium/);
    expect(summary.headline).toContain('360° Spatial Zone Layout & Camera Map');
    expect(summary.items).toEqual(seedCards.map((c) => ({ id: c.id, reason: c.priorityReason })));
    const order = seedCards.map((c) => summary.spokenScript.indexOf(c.title));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('writes Hindi when the operator chose Hindi', () => {
    const summary = buildRuleSummary(seedCards, 'hi');

    expect(summarySchema.safeParse(summary).success).toBe(true);
    expect(summary.headline).toMatch(/[ऀ-ॿ]/);
    expect(summary.spokenScript).toMatch(/[ऀ-ॿ]/);
  });

  it('uses the singular for one item', () => {
    expect(buildRuleSummary(seedCards.slice(0, 1), 'en').headline).toMatch(/^1 approval waiting/);
  });

  it('says so when nothing is waiting', () => {
    const summary = buildRuleSummary([], 'en');

    expect(summarySchema.safeParse(summary).success).toBe(true);
    expect(summary.headline).toMatch(/no approvals waiting/i);
    expect(summary.items).toEqual([]);
  });

  it('stays within the length limits for a long queue', () => {
    const many: SummaryCard[] = Array.from({ length: 30 }, (_, i) => ({
      ...seedCards[0]!,
      id: `apr-${i}`,
      rank: i + 1,
      title: `A rather long approval title number ${i} that goes on for a while`,
    }));

    const summary = buildRuleSummary(many, 'en');

    expect(summarySchema.safeParse(summary).success).toBe(true);
    expect(summary.spokenScript).toMatch(/and 27 more/);
  });
});
