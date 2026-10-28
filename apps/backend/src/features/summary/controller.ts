import type { RequestHandler } from 'express';
import { summaryRequestSchema, summaryStreamEventSchema, type SummaryStreamEvent } from '@approvals/schemas';
import type { AiDeps, ApprovalQueueDependencies } from '../../types/dependencies';
import { message } from '../../ai/messages';
import { openSse } from '../../ai/sse';
import { rankApprovals } from '../approvals/rankApprovals';
import { errorBody } from '../../middleware/errors';
import { streamSummary } from './service';

export type SummaryDependencies = ApprovalQueueDependencies & { ai: AiDeps };

/** POST /api/ai/summary: streams the prioritised queue summary as SSE. */
export function summaryController(deps: SummaryDependencies): RequestHandler {
  return async (req, res) => {
    const request = summaryRequestSchema.safeParse(req.body);
    if (!request.success) {
      res.status(400).json(errorBody('invalid_request', 'The summary request is not valid.'));
      return;
    }
    const ranked = rankApprovals(deps.getApprovals(), deps.priorityTable);
    const client = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) client.abort();
    };
    res.on('close', onClose);
    const send = openSse<SummaryStreamEvent>(res, summaryStreamEventSchema);
    try {
      for await (const event of streamSummary(ranked, request.data.language, deps.ai, client.signal)) send(event);
    } catch (err) {
      console.error(err);
      if (!client.signal.aborted) {
        send({ type: 'error', code: 'answer_failed', message: message(request.data.language, 'answer_failed') });
      }
    } finally {
      res.off('close', onClose);
      res.end();
    }
  };
}
