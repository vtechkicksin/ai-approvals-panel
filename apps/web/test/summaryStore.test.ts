import type { SummaryStreamEvent } from '@approvals/schemas';
import { applySummaryEvent, initialSummaryData, type SummaryData } from '../src/state/summaryStore';
import { finalSummary, skeletonEvent, summaryCards } from './helpers';

const apply = (events: SummaryStreamEvent[], start: SummaryData = { ...initialSummaryData, status: 'connecting' }) =>
  events.reduce(applySummaryEvent, start);

describe('applySummaryEvent', () => {
  it('shows the ranked cards as soon as the skeleton arrives', () => {
    const state = apply([skeletonEvent]);

    expect(state.status).toBe('streaming');
    expect(state.cards.map((c) => c.id)).toEqual(summaryCards.map((c) => c.id));
  });

  it('appends streamed text to the right field', () => {
    const state = apply([
      skeletonEvent,
      { type: 'delta', field: 'headline', text: 'Four ' },
      { type: 'delta', field: 'headline', text: 'waiting.' },
      { type: 'delta', field: 'reason', itemId: 'apr-004', text: 'Urgent ' },
      { type: 'delta', field: 'reason', itemId: 'apr-004', text: 'first.' },
      { type: 'delta', field: 'spokenScript', text: 'Hello.' },
    ]);

    expect(state.headline).toBe('Four waiting.');
    expect(state.reasons['apr-004']).toBe('Urgent first.');
    expect(state.spokenScript).toBe('Hello.');
  });

  it('marks an item confirmed and uses the checked reason', () => {
    const state = apply([
      skeletonEvent,
      { type: 'delta', field: 'reason', itemId: 'apr-003', text: 'streamed' },
      { type: 'item', itemId: 'apr-003', status: 'fallback', reason: 'Policy reason' },
    ]);

    expect(state.confirmed['apr-003']).toBe('fallback');
    expect(state.reasons['apr-003']).toBe('Policy reason');
  });

  it('ignores text for a card that is not on screen', () => {
    const state = apply([skeletonEvent, { type: 'delta', field: 'reason', itemId: 'apr-999', text: 'Invented' }]);

    expect(state.reasons['apr-999']).toBeUndefined();
  });

  it('replaces everything with the final summary on complete', () => {
    const state = apply([
      skeletonEvent,
      { type: 'delta', field: 'headline', text: 'Provisional text' },
      { type: 'complete', source: 'ai', summary: finalSummary },
    ]);

    expect(state).toMatchObject({ status: 'complete', source: 'ai', headline: finalSummary.headline });
    expect(state.reasons['apr-001']).toBe('AI reason for apr-001');
    expect(Object.values(state.confirmed)).toHaveLength(summaryCards.length);
    expect(state.spokenScript).toBe(finalSummary.spokenScript);
  });

  it('keeps the notice so the user knows why the answer is rule-based', () => {
    const state = apply([
      skeletonEvent,
      { type: 'notice', code: 'ai_unavailable', message: 'AI unavailable.' },
      { type: 'complete', source: 'fallback', summary: finalSummary },
    ]);

    expect(state.notice).toEqual({ code: 'ai_unavailable', message: 'AI unavailable.' });
    expect(state.source).toBe('fallback');
  });

  it('shows the server error message', () => {
    const state = apply([{ type: 'error', code: 'answer_failed', message: 'Something went wrong.' }]);

    expect(state).toMatchObject({ status: 'error', errorMessage: 'Something went wrong.' });
  });
});
