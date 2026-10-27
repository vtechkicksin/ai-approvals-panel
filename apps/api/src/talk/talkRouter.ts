import { SystemMessage } from '@langchain/core/messages';
import { Router } from 'express';
import { talkRequestSchema } from '@approvals/schemas';
import type { AppDeps } from '../app';
import { guardedStream } from '../ai/guardedStream';
import { message } from '../ai/messages';
import { streamTextAnswer } from '../ai/sse';
import { rankApprovals } from '../approvals/rankApprovals';
import { errorBody } from '../middleware/errors';
import { talkPrompt } from '../prompts';
import { toModelMessages } from './history';

/** POST /api/ai/talk: streams a chat reply about the approvals queue as SSE. */
export function talkRouter(deps: AppDeps): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const request = talkRequestSchema.safeParse(req.body);
    if (!request.success) {
      res.status(400).json(errorBody('invalid_request', 'The chat request is not valid.'));
      return;
    }
    const { language, messages } = request.data;
    const ranked = rankApprovals(deps.getApprovals(), deps.priorityTable);
    const system = talkPrompt.buildSystem({ ranked, language, today: new Date().toISOString().slice(0, 10) });

    await streamTextAnswer({
      req,
      res,
      language,
      run: (signal) =>
        guardedStream({
          feature: 'talk',
          config: deps.ai.config,
          logger: deps.ai.logger,
          signal,
          start: (s) => deps.ai.createModel().stream([new SystemMessage(system), ...toModelMessages(messages)], { signal: s }),
        }),
      // Free chat has no rule-based equivalent, so point to the actions that still work.
      fallback: () => message(language, 'talk_fallback'),
    });
  });

  return router;
}
