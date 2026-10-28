import type { ChatMessage } from '@approvals/schemas';
import { toModelMessages } from '../../../src/features/talk/history';

const u = (content: string): ChatMessage => ({ role: 'user', content });
const a = (content: string): ChatMessage => ({ role: 'assistant', content });
const shape = (messages: ReturnType<typeof toModelMessages>) => messages.map((m) => [m.getType(), m.text]);

describe('toModelMessages', () => {
  it('maps the conversation to user and AI messages, in order', () => {
    expect(shape(toModelMessages([u('Hi'), a('Hello!'), u('What first?')]))).toEqual([
      ['human', 'Hi'],
      ['ai', 'Hello!'],
      ['human', 'What first?'],
    ]);
  });

  it('merges back-to-back messages from the same side, so turns alternate', () => {
    expect(shape(toModelMessages([u('First try'), u('Second try')]))).toEqual([['human', 'First try\n\nSecond try']]);
  });

  it('keeps only the most recent messages', () => {
    const long = Array.from({ length: 10 }, (_, i) => [u(`q${i}`), a(`a${i}`)]).flat();

    const result = toModelMessages([...long, u('latest')], 5);

    expect(shape(result).at(-1)).toEqual(['human', 'latest']);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('always starts with a user message', () => {
    const result = toModelMessages([u('q1'), a('a1'), u('q2'), a('a2'), u('q3')], 4);

    expect(result[0]!.getType()).toBe('human');
    expect(shape(result).at(-1)).toEqual(['human', 'q3']);
  });
});
