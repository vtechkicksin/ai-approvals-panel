import { parsePartialJson } from '../../../src/features/summary/partialJson';

describe('parsePartialJson', () => {
  it('parses complete JSON', () => {
    expect(parsePartialJson('{"a":"b","n":[1,2]}')).toEqual({ a: 'b', n: [1, 2] });
  });

  it('reads a string that is cut off', () => {
    expect(parsePartialJson('{"headline":"Four appro')).toEqual({ headline: 'Four appro' });
  });

  it('reads nested objects inside an array that is cut off', () => {
    expect(parsePartialJson('{"items":[{"id":"a1","reason":"Saf')).toEqual({ items: [{ id: 'a1', reason: 'Saf' }] });
  });

  it('drops a key that has no value yet', () => {
    expect(parsePartialJson('{"headline":"x","items":')).toEqual({ headline: 'x' });
    expect(parsePartialJson('{"headline":"x","ite')).toEqual({ headline: 'x' });
    expect(parsePartialJson('{"headline":"x",')).toEqual({ headline: 'x' });
  });

  it('drops a trailing comma in an array', () => {
    expect(parsePartialJson('{"items":[{"id":"a"},')).toEqual({ items: [{ id: 'a' }] });
  });

  it('handles escaped characters, even when cut right after a backslash', () => {
    expect(parsePartialJson('{"h":"He said \\"hi\\" and')).toEqual({ h: 'He said "hi" and' });
    expect(parsePartialJson('{"h":"line\\nbreak')).toEqual({ h: 'line\nbreak' });
    expect(parsePartialJson('{"h":"abc\\')).toEqual({ h: 'abc' });
    expect(parsePartialJson('{"h":"abc\\u09')).toEqual({ h: 'abc' });
    expect(parsePartialJson('{"h":"\\u0905')).toEqual({ h: 'अ' });
  });

  it('drops an unfinished number or literal', () => {
    expect(parsePartialJson('{"ok":tr')).toEqual({});
    expect(parsePartialJson('{"a":"b","n":-')).toEqual({ a: 'b' });
  });

  it('reads Devanagari text', () => {
    expect(parsePartialJson('{"headline":"चार अनुमोदन')).toEqual({ headline: 'चार अनुमोदन' });
  });

  it('returns undefined when there is nothing to read', () => {
    expect(parsePartialJson('')).toBeUndefined();
    expect(parsePartialJson('   ')).toBeUndefined();
    expect(parsePartialJson('Sorry, I cannot help with that.')).toBeUndefined();
  });
});
