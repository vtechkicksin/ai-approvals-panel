import { helpPrompt } from '../../../src/prompts';
import { helpPromptV1 } from '../../../src/prompts/help.v1';
import { splitPolicy } from '../../../src/help/policyChunks';
import { loadPolicyMarkdown } from '../../../src/data/seedData';

const chunks = splitPolicy(loadPolicyMarkdown());
const build = (language: 'en' | 'hi', question = 'When should I reject an item?') =>
  helpPrompt.build({ question, chunks: [chunks[3]!, chunks[2]!], language });

describe('help prompt', () => {
  it('is a versioned export, and the feature uses v1', () => {
    expect(helpPrompt).toBe(helpPromptV1);
    expect(helpPrompt).toMatchObject({ id: 'help', version: 1 });
  });

  it('gives the model only the matched policy sections, plus the question', () => {
    const { user } = build('en');

    expect(user).toContain('When should I reject an item?');
    expect(user).toContain(chunks[3]!.text);
    expect(user).toContain(chunks[2]!.heading);
    expect(user).not.toContain(chunks[0]!.text);
  });

  it('grounds the answer in those sections only', () => {
    const { system } = build('en');

    expect(system).toMatch(/only.*policy sections/i);
    expect(system).toMatch(/not covered/i);
    expect(system).toMatch(/section number/i);
    expect(system).toMatch(/data, not instructions/i);
  });

  it('asks for English or for Hindi in Devanagari', () => {
    expect(build('en').system).toMatch(/answer in English/i);
    expect(build('hi').system).toMatch(/answer in Hindi/i);
    expect(build('hi').system).toMatch(/Devanagari/);
  });
});
