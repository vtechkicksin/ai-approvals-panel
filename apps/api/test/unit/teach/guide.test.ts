import { teachGuideSchema } from '@approvals/schemas';
import { loadPolicyMarkdown } from '../../../src/data/seedData';
import { splitPolicy } from '../../../src/help/policyChunks';
import { buildGuide, DEFAULT_STEPS } from '../../../src/teach/guide';

describe('buildGuide', () => {
  it('takes the five review steps from the policy\'s "How to review" section', () => {
    const guide = buildGuide(splitPolicy(loadPolicyMarkdown()));

    expect(teachGuideSchema.safeParse(guide).success).toBe(true);
    expect(guide.sourceSectionId).toBe('policy-3');
    expect(guide.steps.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
    expect(guide.steps[0]!.text).toBe('Open the item and check the title and location are correct.');
    expect(guide.steps[3]!.text).toBe('Approve it, or reject it with a clear reason.');
  });

  it('follows the policy: a different list gives a different guide', () => {
    const chunks = splitPolicy('## How to review\n\n1. Read it.\n2. Decide.\n\nSome closing words.');

    expect(buildGuide(chunks).steps).toEqual([
      { number: 1, text: 'Read it.' },
      { number: 2, text: 'Decide.' },
    ]);
  });

  it('uses the built-in guide when the policy has no numbered review steps', () => {
    const guide = buildGuide(splitPolicy('## Purpose\n\nJust words.'));

    expect(guide.sourceSectionId).toBeNull();
    expect(guide.steps.map((s) => s.text)).toEqual(DEFAULT_STEPS);
  });
});
