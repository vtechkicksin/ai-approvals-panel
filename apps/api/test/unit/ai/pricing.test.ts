import { costUsd } from '../../../src/ai/pricing';

describe('costUsd', () => {
  it('prices Claude Haiku 5.5 at $0.10 in / $0.50 out per million tokens', () => {
    expect(costUsd('claude-haiku-5-5', 1_000_000, 1_000_000)).toBeCloseTo(0.6, 10);
  });

  it('prices a small call precisely', () => {
    // 1,200 in × $0.10/M + 300 out × $0.50/M = 0.00012 + 0.00015
    expect(costUsd('claude-haiku-5-5', 1200, 300)).toBeCloseTo(0.00027, 10);
  });

  it('is zero when no tokens were used', () => {
    expect(costUsd('claude-haiku-5-5', 0, 0)).toBe(0);
  });

  it('returns null for a model it has no price for, instead of guessing', () => {
    expect(costUsd('some-future-model', 100, 100)).toBeNull();
  });
});
