import { findMatches } from '../../../src/features/help/findMatches';
import { splitPolicy } from '../../../src/policy/policyChunks';
import { PolicyRetriever } from '../../../src/policy/policyRetriever';
import { loadPolicyMarkdown } from '../../../src/data/seedData';

const chunks = splitPolicy(loadPolicyMarkdown());
const retriever = new PolicyRetriever({ chunks });
const ids = (question: string) => {
  const result = findMatches(question, retriever, chunks);
  return result.mode === 'none' ? 'none' : [result.mode, result.matches.map((m) => m.chunk.id)];
};

describe('findMatches on the real policy', () => {
  it.each([
    ['When should I reject an item?', 'policy-4'],
    ['What if an urgent item cannot be reviewed in a day?', 'policy-5'],
    ['Do I need to watch the video or read the PDF?', 'policy-3'],
    ['Which category gets high priority?', 'policy-2'],
  ])('finds the right section first for "%s"', (question, expected) => {
    const result = findMatches(question, retriever, chunks);

    expect(result.mode).toBe('matched');
    expect(result.mode !== 'none' && result.matches[0]!.chunk.id).toBe(expected);
  });

  it('returns at most three sections', () => {
    const result = findMatches('review item policy priority urgent reject video category', retriever, chunks);

    expect(result.mode !== 'none' && result.matches.length).toBeLessThanOrEqual(3);
  });

  it.each(['What is the weather in Delhi today?', 'What is it?', 'Tell me a joke'])(
    'finds nothing for "%s" (the policy does not cover it)',
    (question) => {
      expect(ids(question)).toBe('none');
    },
  );

  it('uses the whole (short) policy for a question with no searchable English words', () => {
    expect(ids('मैं किसी आइटम को कब अस्वीकार करूँ?')).toEqual(['all', chunks.map((c) => c.id)]);
  });

  it('still searches the English words in a mixed question', () => {
    expect(ids('reject कब करें?')).toEqual(['matched', expect.arrayContaining(['policy-4'])]);
  });
});
