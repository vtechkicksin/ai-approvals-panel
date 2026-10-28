import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Language, RankedApproval, SummaryStreamEvent } from '@approvals/schemas';
import type { AiDeps } from '../../types/dependencies';
import { guardedStream, type GuardedEvent } from '../../ai/guardedStream';
import { message } from '../../ai/messages';
import { summaryPrompt } from '../../prompts';
import { toCards } from './cards';
import { createSummaryExtractor } from './extractor';
import { finalizeFromSnapshot, finalizeSummary } from './finalize';
import { geminiSummarySchema } from './geminiSchema';
import { buildRuleSummary } from './ruleSummary';

/** Produces validated summary events; the controller owns the HTTP/SSE response. */
export async function* streamSummary(
  ranked: RankedApproval[],
  language: Language,
  ai: AiDeps,
  signal: AbortSignal,
): AsyncGenerator<SummaryStreamEvent> {
  const cards = toCards(ranked);

  // 1. Rule-ranked cards go out at once, before any AI call.
  yield { type: 'skeleton', items: cards, total: cards.length };

  // AI judgment: nothing to summarise means nothing to ask the AI.
  if (cards.length === 0) {
    yield { type: 'complete', source: 'rules', summary: buildRuleSummary(cards, language) };
    return;
  }

  // 2. Stream the AI's JSON through the extractor: only checked text leaves this service.
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
    signal,
    start: (requestSignal) =>
      ai.createModel().stream([new SystemMessage(prompt.system), new HumanMessage(prompt.user)], {
        signal: requestSignal,
        responseSchema: geminiSummarySchema,
      }),
  })) {
    if (event.type === 'end') end = event;
    else if (event.chunk.text) for (const summaryEvent of extractor.push(event.chunk.text)) yield summaryEvent;
  }
  if (signal.aborted) return;

  // 3. One validated final summary, whatever happened.
  if (end?.outcome === 'complete') {
    for (const event of extractor.finish()) yield event;
    yield { type: 'complete', ...finalizeSummary(extractor.text, cards, language) };
  } else if (end?.outcome === 'cut_short') {
    yield { type: 'notice', code: 'cut_short', message: message(language, 'cut_short') };
    yield { type: 'complete', ...finalizeFromSnapshot(extractor.snapshot(), cards, language) };
  } else {
    const code = end?.reason === 'first_token_timeout' ? 'ai_slow' : 'ai_unavailable';
    yield { type: 'notice', code, message: message(language, code) };
    yield { type: 'complete', source: 'fallback', summary: buildRuleSummary(cards, language) };
  }
}
