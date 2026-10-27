/**
 * A fake Gemini API for end-to-end tests. The real API server points at it
 * through AI_BASE_URL, so every layer runs for real except Google itself.
 *
 * Tests script the next replies over HTTP:
 *   POST /__fake/replies  { replies: FakeReply[] }  queue replies (one per AI call)
 *   GET  /__fake/calls                              the requests received so far
 *   POST /__fake/reset                              clear replies and calls
 *
 * With no reply queued, an AI call gets a 500, so an unscripted call can
 * never pass for a real answer.
 */
import http from 'node:http';

export type FakeReply =
  /** A streamed text reply, one SSE chunk per piece. */
  | { kind: 'text'; pieces: string[]; gapMs?: number }
  /** A streamed JSON reply (Gemini JSON mode), split into pieces of `chunk` characters. */
  | { kind: 'json'; value: unknown; raw?: string; chunk?: number }
  /** An HTTP error, e.g. 503 (overloaded) or 429 (quota). */
  | { kind: 'error'; status: number }
  /** Accept the request, then never send a word (first-word timeout). */
  | { kind: 'silent' }
  /** Send these pieces, then go quiet (silence rule → cut short). */
  | { kind: 'stall'; pieces: string[] };

const PORT = Number(process.env.FAKE_GEMINI_PORT ?? 4900);
let replies: FakeReply[] = [];
let calls: { path: string; body: unknown }[] = [];

const chunk = (text: string) => ({ candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0 }] });
const last = (text: string) => ({
  candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 },
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => resolve(body));
  });
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function stream(res: http.ServerResponse, pieces: string[], { gapMs = 40, end = true } = {}) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const [i, piece] of pieces.entries()) {
    if (i > 0) await sleep(gapMs);
    const isLast = end && i === pieces.length - 1;
    res.write(`data: ${JSON.stringify(isLast ? last(piece) : chunk(piece))}\r\n\r\n`);
  }
  if (end) res.end();
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '';
  const body = await readBody(req);

  if (url === '/__fake/health') return json(res, 200, { ok: true });
  if (url === '/__fake/reset') {
    replies = [];
    calls = [];
    return json(res, 200, { ok: true });
  }
  if (url === '/__fake/replies' && req.method === 'POST') {
    replies.push(...(JSON.parse(body) as { replies: FakeReply[] }).replies);
    return json(res, 200, { queued: replies.length });
  }
  if (url === '/__fake/calls') return json(res, 200, { calls });

  if (url.includes(':streamGenerateContent')) {
    calls.push({ path: url, body: body ? (JSON.parse(body) as unknown) : null });
    const reply = replies.shift();
    if (!reply) return json(res, 500, { error: { code: 500, message: 'No fake reply scripted', status: 'INTERNAL' } });

    switch (reply.kind) {
      case 'text':
        return stream(res, reply.pieces, { gapMs: reply.gapMs });
      case 'json': {
        const text = reply.raw ?? JSON.stringify(reply.value);
        const size = reply.chunk ?? 40;
        const pieces = Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size));
        return stream(res, pieces);
      }
      case 'error':
        return json(res, reply.status, { error: { code: reply.status, message: 'Fake error', status: 'UNAVAILABLE' } });
      case 'silent':
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        return; // never writes; the API's first-word timer must give up
      case 'stall':
        return stream(res, reply.pieces, { end: false }); // stays open, says nothing more
    }
  }

  json(res, 404, { error: { code: 404, message: `Fake Gemini has no route for ${url}`, status: 'NOT_FOUND' } });
});

server.listen(PORT, () => console.log(`Fake Gemini listening on http://localhost:${PORT}`));
