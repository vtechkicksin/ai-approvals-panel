import { costUsd } from '../../../src/ai/pricing';

describe('costUsd', () => {
  it('uses the configured price per million tokens', () => {
    const price = { input: 0.3, output: 2.5 };

    expect(costUsd(price, 1_000_000, 1_000_000)).toBeCloseTo(2.8, 10);
    // 1,200 in × $0.30/M + 300 out × $2.50/M = 0.00036 + 0.00075
    expect(costUsd(price, 1200, 300)).toBeCloseTo(0.00111, 10);
  });

  it('is zero on the free tier', () => {
    expect(costUsd({ input: 0, output: 0 }, 5000, 800)).toBe(0);
  });
});
