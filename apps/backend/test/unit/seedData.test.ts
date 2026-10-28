import { approvalItemSchema } from '@approvals/schemas';
import { loadApprovals, loadPriorityTable } from '../../src/data/seedData';

describe('seed data', () => {
  it('loads the 4 approvals from the assignment and they pass the schema', () => {
    const approvals = loadApprovals();

    expect(approvals.map((a) => a.title)).toEqual([
      'Site Patrol Onboarding & Checklists',
      'Level 2 Drone Patrol Video Demo',
      'Safety Equipment & Sensor Specs',
      '360° Spatial Zone Layout & Camera Map',
    ]);
    approvals.forEach((a) => expect(approvalItemSchema.safeParse(a).success).toBe(true));
  });

  it('reads a priority table from the real policy doc', () => {
    expect(loadPriorityTable().size).toBeGreaterThan(0);
  });

  it('has a policy row for every category used in the approvals', () => {
    const table = loadPriorityTable();

    for (const approval of loadApprovals()) {
      expect(table.has(approval.category.toLowerCase())).toBe(true);
    }
  });

  it('fails loudly when the approvals file has a bad item', () => {
    expect(() => loadApprovals(`${__dirname}/../fixtures/bad-approvals.json`)).toThrow(/submittedBy/);
  });
});
