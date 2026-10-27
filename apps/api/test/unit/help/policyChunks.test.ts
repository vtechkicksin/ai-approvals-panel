import { splitPolicy } from '../../../src/help/policyChunks';
import { loadPolicyMarkdown } from '../../../src/data/seedData';

describe('splitPolicy', () => {
  it('splits the real policy into its five sections, in order', () => {
    const chunks = splitPolicy(loadPolicyMarkdown());

    expect(chunks.map((c) => [c.id, c.heading])).toEqual([
      ['policy-1', '1. Purpose'],
      ['policy-2', '2. Priority by category'],
      ['policy-3', '3. How to review an item'],
      ['policy-4', '4. When to reject'],
      ['policy-5', '5. Urgent items and escalation'],
    ]);
  });

  it('keeps each section\'s full text, without the heading line or the doc title', () => {
    const chunks = splitPolicy(loadPolicyMarkdown());

    expect(chunks[3]!.text).toMatch(/^Reject an item if the file is missing/);
    expect(chunks[3]!.text).toMatch(/Always give the reason\.$/);
    expect(chunks.some((c) => c.text.includes('# Approval & Review Policy'))).toBe(false);
  });

  it('numbers sections without a number by position', () => {
    const chunks = splitPolicy('# Title\n\nIntro.\n\n## Scope\n\nA.\n\n## Contacts\n\nB.');

    expect(chunks).toEqual([
      { id: 'policy-1', heading: 'Scope', text: 'A.' },
      { id: 'policy-2', heading: 'Contacts', text: 'B.' },
    ]);
  });

  it('skips empty sections', () => {
    expect(splitPolicy('## Empty\n\n## Full\n\nText.')).toEqual([{ id: 'policy-2', heading: 'Full', text: 'Text.' }]);
  });
});
