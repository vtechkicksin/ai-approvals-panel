import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { RequestHandler } from 'express';
import {
  HELP_LIMITS,
  helpRequestSchema,
  helpStreamEventSchema,
  type HelpStreamEvent,
  type PolicyCitation,
} from '@approvals/schemas';
import type { AiDeps } from '../../types/dependencies';
import { guardedStream } from '../../ai/guardedStream';
import { openSse, streamTextAnswer } from '../../ai/sse';
import { errorBody } from '../../middleware/errors';
import { helpPrompt } from '../../prompts';
import { findMatches } from './findMatches';
import { buildHelpFallback, notCoveredText } from './helpText';
import type { PolicyChunk } from '../../policy/policyChunks';
import { PolicyRetriever } from '../../policy/policyRetriever';

export interface HelpDependencies {
  ai: AiDeps;
  policyChunks: PolicyChunk[];
}

function toCitation(chunk: PolicyChunk): PolicyCitation {
  const flat = chunk.text.replace(/\s+/g, ' ');
  const excerpt = flat.length <= HELP_LIMITS.excerpt ? flat : `${flat.slice(0, HELP_LIMITS.excerpt - 1).trimEnd()}…`;
  return { id: chunk.id, heading: chunk.heading, excerpt };
}

/** POST /api/ai/help: answers a question from the policy, with citations, as SSE. */
export function helpController(deps: HelpDependencies): RequestHandler {
  const retriever = new PolicyRetriever({ chunks: deps.policyChunks });
  return async (req, res) => {
    const request = helpRequestSchema.safeParse(req.body);
    if (!request.success) {
      res.status(400).json(errorBody('invalid_request', 'The help request is not valid.'));
      return;
    }
    const { language, question } = request.data;
    const result = findMatches(question, retriever, deps.policyChunks);

    // AI judgment: nothing relevant in the policy means no AI call at all.
    if (result.mode === 'none') {
      const send = openSse<HelpStreamEvent>(res, helpStreamEventSchema);
      send({ type: 'fallback', text: notCoveredText(language) });
      send({ type: 'done', source: 'rules' });
      res.end();
      return;
    }

    const chunks = result.matches.map((m) => m.chunk);
    const prompt = helpPrompt.build({ question, chunks, language });

    await streamTextAnswer({
      req,
      res,
      language,
      schema: helpStreamEventSchema,
      prelude: [{ type: 'citations' as const, items: chunks.map(toCitation) }],
      run: (signal) =>
        guardedStream({
          feature: 'help',
          config: deps.ai.config,
          logger: deps.ai.logger,
          signal,
          start: (s) =>
            deps.ai.createModel().stream([new SystemMessage(prompt.system), new HumanMessage(prompt.user)], { signal: s }),
        }),
      // Backup: the matching policy text itself, word for word.
      fallback: () => buildHelpFallback(chunks, language),
    });
  };
}
