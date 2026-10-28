import { isGreetingValid } from '../../../src/features/greeting/checkGreeting';

const facts = { total: 4, counts: { urgent: 1, high: 1, medium: 2 }, firstTitle: 'Camera Map' };

describe('isGreetingValid', () => {
  it('accepts a short greeting that keeps the real count', () => {
    expect(isGreetingValid('Morning! You have 4 approvals waiting — start with the urgent Camera Map.', facts)).toBe(true);
  });

  it('rejects wording that drops or changes the count', () => {
    expect(isGreetingValid('Morning! A few approvals are waiting.', facts)).toBe(false);
    expect(isGreetingValid('Morning! You have 5 approvals waiting.', facts)).toBe(false);
  });

  it('does not accept the count hidden inside another number', () => {
    expect(isGreetingValid('Morning! You have 14 approvals waiting.', facts)).toBe(false);
  });

  it('rejects empty or overly long text', () => {
    expect(isGreetingValid('   ', facts)).toBe(false);
    expect(isGreetingValid(`4 approvals ${'very '.repeat(60)}long`, facts)).toBe(false);
  });
});
