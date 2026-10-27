import { SystemMessage } from '@langchain/core/messages';
import { Router } from 'express';
import { teachGuideSchema, teachRequestSchema } from '@approvals/schemas';
import type { AppDeps } from '../app';
import { guardedStream } from '../ai/guardedStream';
import { streamTextAnswer } from '../ai/sse';
import { rankApprovals } from '../approvals/rankApprovals';
import { MIN_SCORE, TOP_K } from '../help/findMatches';
import { PolicyRetriever } from '../help/policyRetriever';
import { errorBody } from '../middleware/errors';
import { teachPrompt } from '../prompts';
import { toModelMessages } from '../talk/history';
import { buildGuide } from './guide';
import { buildTeachFallback } from './teachText';

/** GET /api/teach/guide: the fixed guide (no AI). */
export function teachGuideRouter(deps: AppDeps): Router {
  const router = Router();
  const guide = teachGuideSchema.parse(buildGuide(deps.policyChunks));
  router.get('/', (_req, res) => {
    res.json(guide);
  });
  return router;
}

/** POST /api/ai/teach: streams an answer to a follow-up question about one step. */
export function teachRouter(deps: AppDeps): Router {
  const router = Router();
  const guide = buildGuide(deps.policyChunks);
  const retriever = new PolicyRetriever({ chunks: deps.policyChunks });

  router.post('/', async (req, res) => {
    const request = teachRequestSchema.safeParse(req.body);
    const current = request.success ? guide.steps[request.data.step - 1] : undefined;
    if (!request.success || !current) {
      res.status(400).json(errorBody('invalid_request', 'The teach request is not valid.'));
      return;
    }
    const { language, messages } = request.data;

    // Ground the answer in the policy text that relates to this step and question.
    const question = messages.at(-1)!.content;
    const sections = retriever
      .score(`${current.text} ${question}`)
      .filter((m) => m.score >= MIN_SCORE)
      .slice(0, TOP_K)
      .map((m) => m.chunk);
    const system = teachPrompt.buildSystem({
      steps: guide.steps,
      current,
      sections,
      ranked: rankApprovals(deps.getApprovals(), deps.priorityTable),
      language,
    });
    // The step already quotes its own section, so the backup adds the other related text.
    const backupSections = sections.filter((s) => s.id !== guide.sourceSectionId).slice(0, 2);

    await streamTextAnswer({
      req,
      res,
      language,
      run: (signal) =>
        guardedStream({
          feature: 'teach',
          config: deps.ai.config,
          logger: deps.ai.logger,
          signal,
          start: (s) => deps.ai.createModel().stream([new SystemMessage(system), ...toModelMessages(messages)], { signal: s }),
        }),
      fallback: () => buildTeachFallback(current, backupSections, language),
    });
  });

  return router;
}
