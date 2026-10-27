type Container = '{' | '[';

const CLOSERS: Record<Container, string> = { '{': '}', '[': ']' };
const close = (stack: readonly Container[]) => [...stack].reverse().map((c) => CLOSERS[c]).join('');

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Removes an escape sequence cut off at the very end of a string: `\` or `\u09`. */
function dropPartialEscape(text: string): string {
  const unicode = /(\\+)u[0-9a-fA-F]{0,3}$/.exec(text);
  if (unicode && unicode[1]!.length % 2 === 1) return text.slice(0, unicode.index + unicode[1]!.length - 1);
  const slashes = /\\+$/.exec(text);
  if (slashes && slashes[0].length % 2 === 1) return text.slice(0, -1);
  return text;
}

/**
 * Parses JSON that may be cut off mid-way (a streaming reply), returning the
 * best complete view of it so far, or undefined if nothing can be read yet.
 *
 * It scans once, remembering the last point where the text could be cut and
 * closed into valid JSON. A string value that is still being written is kept
 * (that is how text streams in); a key, number or literal that is still being
 * written is dropped until it is complete.
 */
export function parsePartialJson(text: string): unknown {
  const source = text.trimStart();
  if (!source.startsWith('{') && !source.startsWith('[')) return undefined;

  const complete = tryParse(source);
  if (complete !== undefined) return complete;

  const stack: Container[] = [];
  let lastSafe: { index: number; stack: Container[] } | null = null;
  let inString = false;
  let stringIsKey = false;
  let escaped = false;
  let expectKey = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') {
        inString = false;
        if (!stringIsKey) lastSafe = { index: i + 1, stack: [...stack] };
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      stringIsKey = stack.at(-1) === '{' && expectKey;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
      expectKey = ch === '{';
      lastSafe = { index: i + 1, stack: [...stack] };
    } else if (ch === '}' || ch === ']') {
      stack.pop();
      expectKey = false;
      lastSafe = { index: i + 1, stack: [...stack] };
    } else if (ch === ',') {
      expectKey = stack.at(-1) === '{';
    } else if (ch === ':') {
      expectKey = false;
    } else if (/[-0-9tfn]/.test(ch)) {
      // A number or literal is only safe once something follows it.
      let j = i;
      while (j < source.length && /[-+0-9.eEtruefalsn]/.test(source[j]!)) j++;
      if (j < source.length) lastSafe = { index: j, stack: [...stack] };
      i = j - 1;
    }
  }

  if (inString && !stringIsKey) {
    return tryParse(`${dropPartialEscape(source)}"${close(stack)}`);
  }
  if (!lastSafe) return undefined;
  return tryParse(source.slice(0, lastSafe.index) + close(lastSafe.stack));
}
