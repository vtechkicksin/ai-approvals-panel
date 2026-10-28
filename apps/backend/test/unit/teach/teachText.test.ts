import { loadPolicyMarkdown } from '../../../src/data/seedData';
import { splitPolicy } from '../../../src/policy/policyChunks';
import { buildTeachFallback } from '../../../src/features/teach/teachText';

const chunks = splitPolicy(loadPolicyMarkdown());
const step = { number: 4, text: 'Approve it, or reject it with a clear reason.' };

describe('buildTeachFallback', () => {
  it('says follow-ups are unavailable, repeats the step and quotes the policy', () => {
    const text = buildTeachFallback(step, [chunks[3]!], 'en');

    expect(text).toMatch(/can.t answer follow-up questions right now/i);
    expect(text).toContain('Step 4');
    expect(text).toContain(step.text);
    expect(text).toContain(chunks[3]!.text);
  });

  it('works without any policy section', () => {
    expect(buildTeachFallback(step, [], 'en')).toContain(step.text);
  });

  it('writes the framing in Hindi when asked', () => {
    expect(buildTeachFallback(step, [chunks[3]!], 'hi')).toMatch(/[ऀ-ॿ]/);
  });
});
