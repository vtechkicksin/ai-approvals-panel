import { buildGreeting, GREETING_MAX_LENGTH, greetingFacts, partOfDayAt } from '@approvals/schemas';

const queue = [
  { title: '360° Spatial Zone Layout & Camera Map', effectivePriority: 'urgent' as const },
  { title: 'Safety Equipment & Sensor Specs', effectivePriority: 'high' as const },
  { title: 'Site Patrol Onboarding & Checklists', effectivePriority: 'medium' as const },
  { title: 'Level 2 Drone Patrol Video Demo', effectivePriority: 'medium' as const },
];

describe('greeting template (shared by browser and server)', () => {
  it('picks the part of the day from the local hour', () => {
    expect(partOfDayAt(new Date(2026, 9, 27, 9))).toBe('morning');
    expect(partOfDayAt(new Date(2026, 9, 27, 14))).toBe('afternoon');
    expect(partOfDayAt(new Date(2026, 9, 27, 19))).toBe('evening');
    expect(partOfDayAt(new Date(2026, 9, 27, 0, 30))).toBe('morning');
  });

  it('counts the queue by priority and finds the first item', () => {
    expect(greetingFacts(queue)).toEqual({
      total: 4,
      counts: { urgent: 1, high: 1, medium: 2 },
      firstTitle: '360° Spatial Zone Layout & Camera Map',
    });
    expect(greetingFacts([])).toEqual({ total: 0, counts: {}, firstTitle: null });
  });

  it('greets with the live numbers and where to start', () => {
    expect(buildGreeting(greetingFacts(queue), 'en', 'morning')).toBe(
      'Good morning! 4 approvals are waiting (1 urgent, 1 high, 2 medium). Start with “360° Spatial Zone Layout & Camera Map”.',
    );
  });

  it('uses the singular for one item and the right part of the day', () => {
    expect(buildGreeting(greetingFacts(queue.slice(1, 2)), 'en', 'evening')).toBe(
      'Good evening! 1 approval is waiting (1 high). Start with “Safety Equipment & Sensor Specs”.',
    );
  });

  it('says you are all caught up when nothing is waiting', () => {
    expect(buildGreeting(greetingFacts([]), 'en', 'afternoon')).toBe(
      "Good afternoon! No approvals are waiting. You're all caught up.",
    );
  });

  it('greets in Hindi', () => {
    const text = buildGreeting(greetingFacts(queue), 'hi', 'morning');

    expect(text).toMatch(/^सुप्रभात!/);
    expect(text).toContain('4');
    expect(text).toContain('360° Spatial Zone Layout & Camera Map');
  });

  it('stays short even with a very long title', () => {
    const long = [{ title: 'x'.repeat(400), effectivePriority: 'high' as const }];

    expect(buildGreeting(greetingFacts(long), 'en', 'morning').length).toBeLessThanOrEqual(GREETING_MAX_LENGTH);
  });
});
