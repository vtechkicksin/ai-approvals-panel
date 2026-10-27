import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Router } from 'express';
import { buildGreeting, greetingFacts, greetingRequestSchema, textStreamEventSchema, type TextStreamEvent } from '@approvals/schemas';
import type { AppDeps } from '../app';
import { guardedStream } from '../ai/guardedStream';
import { openSse, streamTextAnswer } from '../ai/sse';
import { rankApprovals } from '../approvals/rankApprovals';
import { errorBody } from '../middleware/errors';
import { greetingPrompt } from '../prompts';
import { isGreetingValid } from './checkGreeting';

/** POST /api/ai/greeting: optional AI wording of the greeting, checked, with the template as backup. */
export function greetingRouter(deps: AppDeps): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const request = greetingRequestSchema.safeParse(req.body);
    if (!request.success) {
      res.status(400).json(errorBody('invalid_request', 'The greeting request is not valid.'));
      return;
    }
    const { language, partOfDay } = request.data;
    const facts = greetingFacts(rankApprovals(deps.getApprovals(), deps.priorityTable));
    const template = buildGreeting(facts, language, partOfDay);

    // AI judgment: an empty queue has nothing worth rewording.
    if (facts.total === 0) {
      const send = openSse<TextStreamEvent>(res, textStreamEventSchema);
      send({ type: 'fallback', text: template });
      send({ type: 'done', source: 'rules' });
      res.end();
      return;
    }

    const prompt = greetingPrompt.build({ facts, template, language, partOfDay });
    await streamTextAnswer({
      req,
      res,
      language,
      run: (signal) =>
        guardedStream({
          feature: 'greeting',
          config: deps.ai.config,
          logger: deps.ai.logger,
          signal,
          start: (s) =>
            deps.ai.createModel().stream([new SystemMessage(prompt.system), new HumanMessage(prompt.user)], { signal: s }),
        }),
      validate: (text) => isGreetingValid(text, facts),
      fallback: () => template,
    });
  });

  return router;
}
