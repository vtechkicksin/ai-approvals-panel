import type { Response } from 'supertest';

/** Parses an SSE body into the JSON payloads of its `data:` lines. */
export function parseSse(body: string): unknown[] {
  return body
    .split(/\n\n+/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n'),
    )
    .filter(Boolean)
    .map((data) => JSON.parse(data) as unknown);
}

/** Supertest parser that keeps a streamed body as one string. */
export function collectText(res: Response, done: (err: Error | null, body: string) => void): void {
  // At parse time supertest hands over the raw Node response stream.
  const stream = res as unknown as NodeJS.ReadableStream;
  let body = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => (body += chunk));
  stream.on('end', () => done(null, body));
}
