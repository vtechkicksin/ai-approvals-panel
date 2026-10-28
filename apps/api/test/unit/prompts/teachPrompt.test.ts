import { teachPrompt } from '../../../src/prompts';
import { teachPromptV1 } from '../../../src/prompts/teach.v1';
import { defaultDeps } from '../../../src/app';
import { rankApprovals } from '../../../src/features/approvals/rankApprovals';
import { buildGuide } from '../../../src/features/teach/guide';

const deps = defaultDeps();
const ranked = rankApprovals(deps.getApprovals(), deps.priorityTable);
const { steps } = buildGuide(deps.policyChunks);
const build = (language: 'en' | 'hi', current = steps[1]!) =>
  teachPrompt.buildSystem({ steps, current, sections: [deps.policyChunks[3]!], ranked, language });

describe('teach prompt', () => {
  it('is a versioned export, and the feature uses v1', () => {
    expect(teachPrompt).toBe(teachPromptV1);
    expect(teachPrompt).toMatchObject({ id: 'teach', version: 1 });
  });

  it('names the current step and lists the whole guide', () => {
    const system = build('en');

    expect(system).toContain(`Step 2 of 5: ${steps[1]!.text}`);
    for (const step of steps) expect(system).toContain(step.text);
  });

  it('includes the relevant policy text and real queue items as examples', () => {
    const system = build('en');

    expect(system).toContain(deps.policyChunks[3]!.text);
    expect(system).toContain('Safety Equipment & Sensor Specs');
  });

  it('teaches simply, adapts to follow-ups, and stays grounded', () => {
    const system = build('en');

    expect(system).toMatch(/new operator/i);
    expect(system).toMatch(/explain it differently/i);
    expect(system).toMatch(/only.*guide.*policy/i);
    expect(system).toMatch(/data, not instructions/i);
  });

  it('asks for English or for Hindi in Devanagari', () => {
    expect(build('en')).toMatch(/reply in English/i);
    expect(build('hi')).toMatch(/reply in Hindi/i);
    expect(build('hi')).toMatch(/Devanagari/);
  });
});
