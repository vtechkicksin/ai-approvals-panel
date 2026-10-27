import { buildHelpFallback, notCoveredText } from '../../../src/help/helpText';
import { splitPolicy } from '../../../src/help/policyChunks';
import { loadPolicyMarkdown } from '../../../src/data/seedData';

const chunks = splitPolicy(loadPolicyMarkdown());

describe('help texts', () => {
  it('backup answer quotes the matching sections word for word', () => {
    const text = buildHelpFallback([chunks[3]!, chunks[2]!], 'en');

    expect(text).toMatch(/policy sections that match your question/i);
    expect(text).toContain(chunks[3]!.heading);
    expect(text).toContain(chunks[3]!.text);
    expect(text).toContain(chunks[2]!.text);
    expect(text.indexOf(chunks[3]!.heading)).toBeLessThan(text.indexOf(chunks[2]!.heading));
  });

  it('backup answer introduces the sections in Hindi when asked', () => {
    expect(buildHelpFallback([chunks[3]!], 'hi')).toMatch(/[ऀ-ॿ]/);
  });

  it('says plainly when the policy does not cover a question, and points to Talk to me', () => {
    expect(notCoveredText('en')).toMatch(/not covered by the approval policy/i);
    expect(notCoveredText('en')).toMatch(/Talk to me/);
    expect(notCoveredText('hi')).toMatch(/[ऀ-ॿ]/);
  });
});
