import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { RequestHandler, Response } from 'express';
import {
  summaryRequestSchema,
  summaryStreamEventSchema,
  type Language,
  type RankedApproval,
  type SummaryStreamEvent,
} from '@approvals/schemas';
import type { AiDeps, AppDeps } from '../app';
import { guardedStream, type GuardedEvent } from '../ai/guardedStream';
import { message } from '../ai/messages';
import { openSse } from '../ai/sse';
import { rankApprovals } from '../approvals/rankApprovals';
import { errorBody } from '../middleware/errors';
import { summaryPrompt } from '../prompts';
import { toCards } from '../summary/cards';
import { createSummaryExtractor } from '../summary/extractor';
import { finalizeFromSnapshot, finalizeSummary } from '../summary/finalize';
import { geminiSummarySchema } from '../summary/geminiSchema';
import { buildRuleSummary } from '../summary/ruleSummary';

async function streamSummary(res: Response, ranked: RankedApproval[], language: Language, ai: AiDeps): Promise<void> {
  const client = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) client.abort();
  };
  res.on('close', onClose);
  const send = openSse<SummaryStreamEvent>(res, summaryStreamEventSchema);
  const cards = toCards(ranked);

  try {
    // 1. Rule-ranked cards go out at once, before any AI call.
    send({ type: 'skeleton', items: cards, total: cards.length });

    // AI judgment: nothing to summarise means nothing to ask the AI.
    if (cards.length === 0) {
      send({ type: 'complete', source: 'rules', summary: buildRuleSummary(cards, language) });
      return;
    }

    // 2. Stream the AI's JSON through the extractor: only checked text reaches the browser.
    const prompt = summaryPrompt.build({
      cards,
      language,
      today: new Date().toISOString().slice(0, 10),
      details: Object.fromEntries(ranked.map((r) => [r.id, { submittedBy: r.submittedBy, submittedAt: r.submittedAt }])),
    });
    const extractor = createSummaryExtractor(cards);
    let end: Extract<GuardedEvent, { type: 'end' }> | undefined;

    for await (const event of guardedStream({
      feature: 'summary',
      config: ai.config,
      logger: ai.logger,
      signal: client.signal,
      start: (signal) =>
        ai.createModel().stream([new SystemMessage(prompt.system), new HumanMessage(prompt.user)], {
          signal,
          responseSchema: geminiSummarySchema,
        }),
    })) {
      if (event.type === 'end') end = event;
      else if (event.chunk.text) for (const e of extractor.push(event.chunk.text)) send(e);
    }
    if (client.signal.aborted) return;

    // 3. One validated final summary, whatever happened.
    if (end?.outcome === 'complete') {
      for (const e of extractor.finish()) send(e);
      send({ type: 'complete', ...finalizeSummary(extractor.text, cards, language) });
    } else if (end?.outcome === 'cut_short') {
      send({ type: 'notice', code: 'cut_short', message: message(language, 'cut_short') });
      send({ type: 'complete', ...finalizeFromSnapshot(extractor.snapshot(), cards, language) });
    } else {
      const code = end?.reason === 'first_token_timeout' ? 'ai_slow' : 'ai_unavailable';
      send({ type: 'notice', code, message: message(language, code) });
      send({ type: 'complete', source: 'fallback', summary: buildRuleSummary(cards, language) });
    }
  } catch (err) {
    console.error(err);
    send({ type: 'error', code: 'answer_failed', message: message(language, 'answer_failed') });
  } finally {
    res.off('close', onClose);
    res.end();
  }
}

/** POST /api/ai/summary: streams the prioritised queue summary as SSE. */
export function summaryController(deps: AppDeps): RequestHandler {
  return async (req, res) => {
    const request = summaryRequestSchema.safeParse(req.body);
    if (!request.success) {
      res.status(400).json(errorBody('invalid_request', 'The summary request is not valid.'));
      return;
    }
    const ranked = rankApprovals(deps.getApprovals(), deps.priorityTable);
    await streamSummary(res, ranked, request.data.language, deps.ai);
  };
}
