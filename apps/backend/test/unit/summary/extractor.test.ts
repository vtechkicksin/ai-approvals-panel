import { summaryStreamEventSchema, type SummaryStreamEvent } from '@approvals/schemas';
import { createSummaryExtractor } from '../../../src/features/summary/extractor';
import { chunkText, goodSummaryJson, seedCards } from '../../helpers/summaryKit';

function feed(chunks: string[], { finish = false } = {}) {
  const extractor = createSummaryExtractor(seedCards);
  const events: SummaryStreamEvent[] = [];
  for (const chunk of chunks) events.push(...extractor.push(chunk));
  if (finish) events.push(...extractor.finish());
  for (const event of events) expect(summaryStreamEventSchema.safeParse(event).success).toBe(true);
  return { events, extractor };
}

const deltas = (events: SummaryStreamEvent[], field: string, itemId?: string) =>
  events.flatMap((e) => (e.type === 'delta' && e.field === field && e.itemId === itemId ? [e.text] : []));
const items = (events: SummaryStreamEvent[]) =>
  events.flatMap((e) => (e.type === 'item' ? [[e.itemId, e.status, e.reason]] : []));

describe('createSummaryExtractor', () => {
  it('streams the headline as appended pieces across chunk boundaries', () => {
    const { events } = feed(['{"headline":"Four app', 'rovals waiting","items":[']);

    expect(deltas(events, 'headline')).toEqual(['Four app', 'rovals waiting']);
  });

  it('streams a reason only once its item id is complete and known', () => {
    const { events } = feed(['{"headline":"H","items":[{"id":"apr-0', '04","reason":"Review ', 'first"}']);

    expect(deltas(events, 'reason', 'apr-004')).toEqual(['Review ', 'first']);
  });

  it('confirms an item as soon as the next one starts', () => {
    const { events } = feed(['{"headline":"H","items":[{"id":"apr-004","reason":"Review first"},{"id":"apr-003"']);

    expect(items(events)).toEqual([['apr-004', 'ok', 'Review first']]);
  });

  it('confirms the last item when the list closes', () => {
    const { events } = feed(['{"headline":"H","items":[{"id":"apr-004","reason":"Review first"}],"spokenScript":"']);

    expect(items(events)).toEqual([['apr-004', 'ok', 'Review first']]);
  });

  it('never streams text for an item id that is not in the queue', () => {
    const { events } = feed(['{"headline":"H","items":[{"id":"apr-999","reason":"Invented"},{"id":"apr-004"']);

    expect(JSON.stringify(events)).not.toContain('Invented');
    expect(JSON.stringify(events)).not.toContain('apr-999');
  });

  it('ignores a second entry for the same id', () => {
    const json = '{"headline":"H","items":[{"id":"apr-004","reason":"One"},{"id":"apr-004","reason":"Two"},{"id":"apr-003"';
    const { events } = feed([json]);

    expect(deltas(events, 'reason', 'apr-004')).toEqual(['One']);
    expect(JSON.stringify(events)).not.toContain('Two');
  });

  it('replaces an item whose reason is empty with the policy reason', () => {
    const { events } = feed(['{"headline":"H","items":[{"id":"apr-003","reason":"  "},{"id":"apr-004"']);

    expect(items(events)).toEqual([['apr-003', 'fallback', seedCards[1]!.priorityReason]]);
  });

  it('stops streaming a field at its length limit', () => {
    const long = 'x'.repeat(250);
    const { events } = feed([`{"headline":"${long.slice(0, 150)}`, `${long.slice(150)}","items":[`]);

    expect(deltas(events, 'headline').join('')).toHaveLength(200);
  });

  it('streams the spoken script', () => {
    const { events } = feed(['{"headline":"H","items":[],"spokenScript":"You have ', 'four approvals."}']);

    expect(deltas(events, 'spokenScript')).toEqual(['You have ', 'four approvals.']);
  });

  it('unescapes text inside pieces', () => {
    const { events } = feed(['{"headline":"Say \\"hi', '\\" now","items":[']);

    expect(deltas(events, 'headline').join('')).toBe('Say "hi" now');
  });

  it('on finish, gives every item the model never covered its policy reason', () => {
    const { events } = feed(['{"headline":"H","items":[{"id":"apr-004","reason":"Review first"}]}'], { finish: true });

    expect(items(events)).toEqual([
      ['apr-004', 'ok', 'Review first'],
      ['apr-003', 'fallback', seedCards[1]!.priorityReason],
      ['apr-001', 'fallback', seedCards[2]!.priorityReason],
      ['apr-002', 'fallback', seedCards[3]!.priorityReason],
    ]);
  });

  it('handles a full good reply in small pieces', () => {
    const { events, extractor } = feed(chunkText(JSON.stringify(goodSummaryJson), 7), { finish: true });

    expect(deltas(events, 'headline').join('')).toBe(goodSummaryJson.headline);
    expect(deltas(events, 'spokenScript').join('')).toBe(goodSummaryJson.spokenScript);
    expect(items(events).map(([id, status]) => [id, status])).toEqual([
      ['apr-004', 'ok'],
      ['apr-003', 'ok'],
      ['apr-001', 'ok'],
      ['apr-002', 'ok'],
    ]);
    expect(extractor.text).toBe(JSON.stringify(goodSummaryJson));
  });

  it('remembers only finished parts in its snapshot', () => {
    const { extractor } = feed(['{"headline":"Done","items":[{"id":"apr-004","reason":"Ok"},{"id":"apr-003","reason":"Half']);

    expect(extractor.snapshot()).toEqual({ headline: 'Done', reasons: { 'apr-004': 'Ok' } });
  });

  it('keeps the headline out of the snapshot until the model moves past it', () => {
    const { extractor } = feed(['{"headline":"Still writ']);

    expect(extractor.snapshot()).toEqual({ reasons: {} });
  });

  it('never throws on text that is not JSON', () => {
    const { events } = feed(['Sorry, I cannot do that.'], { finish: true });

    expect(events.every((e) => e.type === 'item' && e.status === 'fallback')).toBe(true);
  });
});
