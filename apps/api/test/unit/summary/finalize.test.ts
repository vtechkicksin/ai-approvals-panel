import { summarySchema } from '@approvals/schemas';
import { finalizeFromSnapshot, finalizeSummary } from '../../../src/summary/finalize';
import { buildRuleSummary } from '../../../src/summary/ruleSummary';
import { goodSummaryJson, seedCards } from '../../helpers/summaryKit';

const rules = buildRuleSummary(seedCards, 'en');

describe('finalizeSummary (complete reply)', () => {
  it('accepts a good reply as written by the AI', () => {
    const { summary, source } = finalizeSummary(JSON.stringify(goodSummaryJson), seedCards, 'en');

    expect(source).toBe('ai');
    expect(summary).toEqual(goodSummaryJson);
  });

  it('keeps the queue order even if the AI reorders items', () => {
    const reordered = { ...goodSummaryJson, items: [...goodSummaryJson.items].reverse() };

    const { summary, source } = finalizeSummary(JSON.stringify(reordered), seedCards, 'en');

    expect(summary.items.map((i) => i.id)).toEqual(['apr-004', 'apr-003', 'apr-001', 'apr-002']);
    expect(summary.items[0]!.reason).toBe(goodSummaryJson.items[0]!.reason);
    expect(source).toBe('ai');
  });

  it('drops invented items and fills missing ones with policy reasons', () => {
    const reply = {
      ...goodSummaryJson,
      items: [goodSummaryJson.items[0], { id: 'apr-999', reason: 'Invented item' }],
    };

    const { summary, source } = finalizeSummary(JSON.stringify(reply), seedCards, 'en');

    expect(source).toBe('partial');
    expect(summary.items.map((i) => i.id)).toEqual(['apr-004', 'apr-003', 'apr-001', 'apr-002']);
    expect(summary.items[1]!.reason).toBe(seedCards[1]!.priorityReason);
    expect(JSON.stringify(summary)).not.toContain('Invented');
  });

  it('replaces a field that breaks the rules (too long) with rule-based text', () => {
    const reply = { ...goodSummaryJson, headline: 'x'.repeat(500) };

    const { summary, source } = finalizeSummary(JSON.stringify(reply), seedCards, 'en');

    expect(source).toBe('partial');
    expect(summary.headline).toBe(rules.headline);
    expect(summary.spokenScript).toBe(goodSummaryJson.spokenScript);
  });

  it.each([
    ['broken JSON', '{"headline":"Four approvals'],
    ['not JSON at all', 'Sorry, I cannot help with that.'],
    ['the wrong shape', JSON.stringify({ headline: 5, items: 'none' })],
    ['an empty reply', ''],
  ])('falls back to the rule-based summary for %s', (_label, raw) => {
    const { summary, source } = finalizeSummary(raw, seedCards, 'en');

    expect(source).toBe('fallback');
    expect(summary).toEqual(rules);
  });

  it('always returns a summary that passes the shared schema', () => {
    for (const raw of [JSON.stringify(goodSummaryJson), '{}', 'null', '[]', '{"items":[null,1,"a"]}']) {
      expect(summarySchema.safeParse(finalizeSummary(raw, seedCards, 'en').summary).success).toBe(true);
    }
  });
});

describe('finalizeFromSnapshot (reply cut short)', () => {
  it('keeps finished parts and fills the rest with rules', () => {
    const { summary, source } = finalizeFromSnapshot(
      { headline: 'AI headline', reasons: { 'apr-004': 'AI reason' } },
      seedCards,
      'en',
    );

    expect(source).toBe('partial');
    expect(summary.headline).toBe('AI headline');
    expect(summary.items[0]).toEqual({ id: 'apr-004', reason: 'AI reason' });
    expect(summary.items[1]!.reason).toBe(seedCards[1]!.priorityReason);
    expect(summary.spokenScript).toBe(rules.spokenScript);
  });

  it('is a plain fallback when nothing was finished', () => {
    expect(finalizeFromSnapshot({ reasons: {} }, seedCards, 'en')).toEqual({ summary: rules, source: 'fallback' });
  });
});
