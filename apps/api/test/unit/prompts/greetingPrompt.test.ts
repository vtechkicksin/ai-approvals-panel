import { greetingPrompt } from '../../../src/prompts';
import { greetingPromptV1 } from '../../../src/prompts/greeting.v1';

const facts = { total: 4, counts: { urgent: 1, high: 1, medium: 2 }, firstTitle: 'Camera Map' };
const template = 'Good morning! 4 approvals are waiting (1 urgent, 1 high, 2 medium). Start with “Camera Map”.';
const build = (language: 'en' | 'hi') => greetingPrompt.build({ facts, template, language, partOfDay: 'morning' });

describe('greeting prompt', () => {
  it('is a versioned export, and the feature uses v1', () => {
    expect(greetingPrompt).toBe(greetingPromptV1);
    expect(greetingPrompt).toMatchObject({ id: 'greeting', version: 1 });
  });

  it('asks only to reword the template, keeping every number as digits', () => {
    const { system, user } = build('en');

    expect(system).toMatch(/reword/i);
    expect(system).toMatch(/keep every number.*digits/i);
    expect(system).toMatch(/do not add/i);
    expect(user).toContain(template);
    expect(user).toContain('"total":4');
  });

  it('asks for English or for Hindi in Devanagari', () => {
    expect(build('en').system).toMatch(/write in English/i);
    expect(build('hi').system).toMatch(/write in Hindi/i);
    expect(build('hi').system).toMatch(/Devanagari/);
  });
});
